-- Reauthentication may replace a missing/expired provider credential while deletion is idle.
create or replace function public.store_provider_credential(p_owner uuid,p_provider text,p_subject text,p_ciphertext text,p_generation uuid) returns void language plpgsql security definer set search_path='' as $$
declare job private.account_deletions;
begin
 perform pg_advisory_xact_lock(hashtextextended(p_owner::text||':account-delete',0));
 select * into job from private.account_deletions where user_id=p_owner for update;
 if found and (job.status='complete' or job.leased_at>now()-interval '60 seconds') then raise exception 'DELETION_RUNNING' using errcode='42501';end if;
 if not exists(select 1 from auth.identities where user_id=p_owner and provider=p_provider and provider_id=p_subject) then raise exception 'PROVIDER_IDENTITY_MISMATCH' using errcode='42501';end if;
 insert into private.provider_credentials(user_id,provider,subject,ciphertext,generation) values(p_owner,p_provider,p_subject,p_ciphertext,p_generation)
 on conflict(user_id,provider) do update set subject=excluded.subject,ciphertext=excluded.ciphertext,generation=excluded.generation,revoked=false,updated_at=now();
end; $$;
create function public.rotate_deletion_provider_credential(p_owner uuid,p_provider text,p_generation uuid,p_lease uuid,p_ciphertext text) returns void language plpgsql security definer set search_path='' as $$
begin
 if not exists(select 1 from private.account_deletions where user_id=p_owner and lease_id=p_lease and status='pending') then raise exception 'INVALID_LEASE' using errcode='42501';end if;
 update private.provider_credentials set ciphertext=p_ciphertext,updated_at=now() where user_id=p_owner and provider=p_provider and generation=p_generation and not revoked;
 if not found then raise exception 'PROVIDER_GENERATION_CHANGED';end if;
end; $$;
revoke all on function public.rotate_deletion_provider_credential(uuid,text,uuid,uuid,text) from public,anon,authenticated;
grant execute on function public.rotate_deletion_provider_credential(uuid,text,uuid,uuid,text) to service_role;
