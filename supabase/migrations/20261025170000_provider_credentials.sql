-- Provider tokens are encrypted by the Edge function before entering PostgreSQL.
create table private.provider_credentials (
 user_id uuid not null references auth.users(id) on delete cascade,
 provider text not null check(provider in ('apple','kakao')),
 subject text not null check(length(subject) between 1 and 300),
 ciphertext text not null check(length(ciphertext) between 32 and 100000),
 generation uuid not null,
 revoked boolean not null default false,
 updated_at timestamptz not null default now(),
 primary key(user_id,provider)
);
alter table private.provider_credentials enable row level security;
revoke all on private.provider_credentials from public,anon,authenticated;
create function public.store_provider_credential(p_owner uuid,p_provider text,p_subject text,p_ciphertext text,p_generation uuid) returns void language plpgsql security definer set search_path='' as $$
begin
 if not private.account_writable(p_owner) then raise exception 'ACCOUNT_DELETING' using errcode='42501'; end if;
 if not exists(select 1 from auth.identities where user_id=p_owner and provider=p_provider and provider_id=p_subject) then raise exception 'PROVIDER_IDENTITY_MISMATCH' using errcode='42501';end if;
 insert into private.provider_credentials(user_id,provider,subject,ciphertext,generation) values(p_owner,p_provider,p_subject,p_ciphertext,p_generation)
 on conflict(user_id,provider) do update set subject=excluded.subject,ciphertext=excluded.ciphertext,generation=excluded.generation,revoked=false,updated_at=now();
end; $$;
create function public.deletion_provider_credentials(p_owner uuid,p_lease uuid) returns jsonb language plpgsql security definer set search_path='' as $$
begin
 if not exists(select 1 from private.account_deletions where user_id=p_owner and lease_id=p_lease and status='pending') then raise exception 'INVALID_LEASE' using errcode='42501';end if;
 return coalesce((select jsonb_agg(jsonb_build_object('provider',provider,'subject',subject,'ciphertext',ciphertext,'generation',generation,'revoked',revoked)) from private.provider_credentials where user_id=p_owner),'[]'::jsonb);
end; $$;
create function public.mark_provider_revoked(p_owner uuid,p_provider text,p_generation uuid,p_lease uuid) returns void language plpgsql security definer set search_path='' as $$
begin
 if not exists(select 1 from private.account_deletions where user_id=p_owner and lease_id=p_lease and status='pending') then raise exception 'INVALID_LEASE' using errcode='42501';end if;
 update private.provider_credentials set revoked=true,ciphertext='revoked-token-material-erased-0000',updated_at=now() where user_id=p_owner and provider=p_provider and generation=p_generation;
 if not found then raise exception 'PROVIDER_GENERATION_CHANGED';end if;
end; $$;
revoke all on function public.store_provider_credential(uuid,text,text,text,uuid),public.deletion_provider_credentials(uuid,uuid),public.mark_provider_revoked(uuid,text,uuid,uuid) from public,anon,authenticated;
grant execute on function public.store_provider_credential(uuid,text,text,text,uuid),public.deletion_provider_credentials(uuid,uuid),public.mark_provider_revoked(uuid,text,uuid,uuid) to service_role;
