-- Reauthentication may replace a missing/expired provider credential while deletion is idle.
create or replace function public.store_provider_credential(p_owner uuid,p_provider text,p_subject text,p_ciphertext text,p_generation uuid) returns void language plpgsql security definer set search_path='' as $$
declare job private.account_deletions;
begin
 perform pg_advisory_xact_lock(hashtextextended(p_owner::text||':account-delete',0));
 select * into job from private.account_deletions where user_id=p_owner for update;
 if found and (job.status='complete' or job.leased_at>now()-interval '60 seconds') then raise exception 'DELETION_RUNNING' using errcode='42501';end if;
 if not exists(select 1 from auth.identities where user_id=p_owner and provider=p_provider and provider_id=p_subject) then raise exception 'PROVIDER_IDENTITY_MISMATCH' using errcode='42501';end if;
 insert into private.provider_credentials(user_id,provider,subject,ciphertext,generation) values(p_owner,p_provider,p_subject,p_ciphertext,p_generation)
 on conflict(user_id,provider) do update set subject=excluded.subject,ciphertext=excluded.ciphertext,generation=excluded.generation,revoked=false,capture_hash=null,updated_at=now();
end; $$;
create function public.rotate_deletion_provider_credential(p_owner uuid,p_provider text,p_generation uuid,p_lease uuid,p_ciphertext text) returns void language plpgsql security definer set search_path='' as $$
begin
 perform 1 from private.account_deletions where user_id=p_owner and lease_id=p_lease and status='pending' and leased_at>now()-interval '60 seconds' for update;
 if not found then raise exception 'INVALID_LEASE' using errcode='42501';end if;
 update private.provider_credentials set ciphertext=p_ciphertext,updated_at=now() where user_id=p_owner and provider=p_provider and generation=p_generation and not revoked;
 if not found then raise exception 'PROVIDER_GENERATION_CHANGED';end if;
end; $$;
revoke all on function public.rotate_deletion_provider_credential(uuid,text,uuid,uuid,text) from public,anon,authenticated;
grant execute on function public.rotate_deletion_provider_credential(uuid,text,uuid,uuid,text) to service_role;

-- Serialize revocation receipts with lease acquisition and reject late workers.
create or replace function public.mark_provider_revoked(p_owner uuid,p_provider text,p_generation uuid,p_lease uuid) returns void language plpgsql security definer set search_path='' as $$
begin
 perform 1 from private.account_deletions where user_id=p_owner and lease_id=p_lease and status='pending' and leased_at>now()-interval '60 seconds' for update;
 if not found then raise exception 'INVALID_LEASE' using errcode='42501';end if;
 update private.provider_credentials set revoked=true,ciphertext='revoked-token-material-erased-0000',updated_at=now() where user_id=p_owner and provider=p_provider and generation=p_generation;
 if not found then raise exception 'PROVIDER_GENERATION_CHANGED';end if;
end; $$;

-- An acknowledged capture can be replayed without refreshing a token a second time.
-- This is a one-way fingerprint; refresh/access token material stays encrypted.
alter table private.provider_credentials add column capture_hash text check(capture_hash is null or capture_hash ~ '^[a-f0-9]{64}$');
create function public.provider_credential_captured(p_owner uuid,p_provider text,p_subject text,p_capture_hash text) returns boolean language sql security definer set search_path='' as $$
 select exists(select 1 from private.provider_credentials c join auth.identities i on i.user_id=c.user_id and i.provider=c.provider and i.provider_id=c.subject where c.user_id=p_owner and c.provider=p_provider and c.subject=p_subject and c.capture_hash=p_capture_hash and not c.revoked);
$$;
create function public.store_provider_credential_capture(p_owner uuid,p_provider text,p_subject text,p_ciphertext text,p_generation uuid,p_capture_hash text) returns void language plpgsql security definer set search_path='' as $$
begin
 if p_capture_hash !~ '^[a-f0-9]{64}$' or p_capture_hash is null then raise exception 'INVALID_CAPTURE_HASH';end if;
 perform public.store_provider_credential(p_owner,p_provider,p_subject,p_ciphertext,p_generation);
 update private.provider_credentials set capture_hash=p_capture_hash where user_id=p_owner and provider=p_provider and subject=p_subject and generation=p_generation;
 if not found then raise exception 'PROVIDER_GENERATION_CHANGED';end if;
end; $$;
revoke all on function public.provider_credential_captured(uuid,text,text,text),public.store_provider_credential_capture(uuid,text,text,text,uuid,text) from public,anon,authenticated;
grant execute on function public.provider_credential_captured(uuid,text,text,text),public.store_provider_credential_capture(uuid,text,text,text,uuid,text) to service_role;
