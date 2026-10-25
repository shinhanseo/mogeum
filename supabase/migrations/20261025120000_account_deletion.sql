-- Server-owned deletion receipts survive Auth removal so an interrupted response can be retried.
create table private.account_deletions (
 user_id uuid primary key,
 token_hash text not null check(token_hash ~ '^[a-f0-9]{64}$'),
 status text not null default 'pending' check(status in('pending','complete')),
 created_at timestamptz not null default now(), completed_at timestamptz,
 lease_id uuid, leased_at timestamptz
);
alter table private.account_deletions enable row level security;
revoke all on private.account_deletions from public,anon,authenticated;

create function private.account_writable(p_owner uuid) returns boolean language plpgsql security definer set search_path='' as $$
begin
 perform pg_advisory_xact_lock(hashtextextended(p_owner::text||':account-delete',0));
 return not exists(select 1 from private.account_deletions where user_id=p_owner);
end; $$;
revoke all on function private.account_writable(uuid) from public,anon,authenticated;
create function private.guard_account_write() returns trigger language plpgsql security definer set search_path='' as $$
declare owner_id uuid;
begin
 owner_id:=case when TG_OP='DELETE' then old.user_id else new.user_id end;
 -- Only the deletion worker may remove frozen rows. Inserts/updates remain blocked even for a late AI job.
 if TG_OP='DELETE' and (current_setting('role',true)='service_role' or not exists(select 1 from auth.users where id=owner_id)) then return old; end if;
 if TG_OP='UPDATE' and TG_TABLE_SCHEMA='public' and TG_TABLE_NAME='cellar_entries' and current_setting('role',true)='service_role'
  and to_jsonb(new)->'representative_photo_id'='null'::jsonb
  and (to_jsonb(new)-'representative_photo_id')=(to_jsonb(old)-'representative_photo_id') then return new; end if;
 if not private.account_writable(owner_id) then raise exception 'ACCOUNT_DELETING' using errcode='42501'; end if;
 if TG_OP='DELETE' then return old; else return new; end if;
end; $$;
revoke all on function private.guard_account_write() from public,anon,authenticated;
do $$ declare item record; begin
 for item in select table_schema,table_name from information_schema.columns
 where column_name='user_id' and table_schema in('public','private')
 and table_name not in('account_deletions','photo_deletion_jobs','deleted_record_operations')
 and exists(select 1 from information_schema.tables t where t.table_schema=columns.table_schema and t.table_name=columns.table_name and t.table_type='BASE TABLE')
 loop execute format('create trigger guard_account_write before insert or update or delete on %I.%I for each row execute function private.guard_account_write()',item.table_schema,item.table_name);end loop;
end $$;
create function private.guard_account_upload() returns trigger language plpgsql security definer set search_path='' as $$
declare owner_id uuid;
begin
 if new.bucket_id='record-photos' and split_part(new.name,'/',1) ~ '^[a-f0-9-]{36}$' then
  owner_id:=split_part(new.name,'/',1)::uuid;
  if not private.account_writable(owner_id) then raise exception 'ACCOUNT_DELETING' using errcode='42501'; end if;
 end if;
 return new;
end; $$;
revoke all on function private.guard_account_upload() from public,anon,authenticated;
create trigger guard_account_upload before insert or update on storage.objects for each row execute function private.guard_account_upload();

create function public.account_deletion_status() returns text language plpgsql security definer set search_path='' as $$
begin
 if auth.uid() is null then raise exception 'UNAUTHENTICATED' using errcode='42501'; end if;
 return (select status from private.account_deletions where user_id=auth.uid());
end; $$;
revoke all on function public.account_deletion_status() from public,anon;
grant execute on function public.account_deletion_status() to authenticated;

create function public.begin_account_deletion(p_owner uuid,p_token_hash text,p_lease uuid) returns boolean language plpgsql security definer set search_path='' as $$
declare job private.account_deletions;
begin
 if p_owner is null or p_lease is null or p_token_hash !~ '^[a-f0-9]{64}$' or not exists(select 1 from auth.users where id=p_owner) then raise exception 'INVALID_OWNER' using errcode='42501';end if;
 perform pg_advisory_xact_lock(hashtextextended(p_owner::text||':account-delete',0));
 select * into job from private.account_deletions where user_id=p_owner for update;
 if found and job.status='complete' then return false;end if;
 if found and job.leased_at>now()-interval '60 seconds' then return false;end if;
 insert into private.account_deletions(user_id,token_hash,lease_id,leased_at) values(p_owner,p_token_hash,p_lease,now())
 on conflict(user_id) do update set token_hash=excluded.token_hash,lease_id=excluded.lease_id,leased_at=now();
 -- A completed receipt can acknowledge retries for 30 days; prune on subsequent deletion starts.
 delete from private.account_deletions where status='complete' and completed_at<now()-interval '30 days';
 return true;
end; $$;
create function public.account_deletion_files(p_owner uuid,p_lease uuid) returns text[] language plpgsql security definer set search_path='' as $$
begin
 if not exists(select 1 from private.account_deletions where user_id=p_owner and lease_id=p_lease and status='pending') then raise exception 'INVALID_LEASE' using errcode='42501';end if;
 return array(select name from storage.objects where bucket_id='record-photos' and split_part(name,'/',1)=p_owner::text order by name limit 100);
end; $$;
create function public.purge_account_data(p_owner uuid,p_lease uuid) returns void language plpgsql security definer set search_path='' as $$
begin
 perform pg_advisory_xact_lock(hashtextextended(p_owner::text||':account-delete',0));
 if not exists(select 1 from private.account_deletions where user_id=p_owner and lease_id=p_lease and status='pending') then raise exception 'INVALID_LEASE' using errcode='42501';end if;
 if exists(select 1 from storage.objects where bucket_id='record-photos' and split_part(name,'/',1)=p_owner::text) then raise exception 'PHOTOS_REMAIN';end if;
 delete from public.tasting_records where user_id=p_owner;
 delete from public.cellar_entries where user_id=p_owner;
 -- Other FK-owned tables are removed by Auth deletion. Remove non-FK binary cleanup receipts explicitly.
 delete from public.photo_deletion_jobs where user_id=p_owner;
end; $$;
create function public.finish_account_deletion(p_owner uuid,p_lease uuid) returns void language plpgsql security definer set search_path='' as $$
begin
 if exists(select 1 from auth.users where id=p_owner) then raise exception 'AUTH_REMAINS';end if;
 update private.account_deletions set status='complete',completed_at=now(),lease_id=null,leased_at=null where user_id=p_owner and lease_id=p_lease;
 if not found then raise exception 'INVALID_LEASE' using errcode='42501';end if;
end; $$;
create function public.completed_account_deletion(p_token_hash text) returns boolean language plpgsql security definer set search_path='' as $$
declare job private.account_deletions;
begin
 select * into job from private.account_deletions where token_hash=p_token_hash for update;
 if not found then return false;end if;
 -- Auth deletion may succeed even when its response/receipt write was lost. A receipt alone cannot delete anything.
 if job.status='pending' and not exists(select 1 from auth.users where id=job.user_id)
  and not exists(select 1 from storage.objects where bucket_id='record-photos' and split_part(name,'/',1)=job.user_id::text)
  and not exists(select 1 from public.tasting_records where user_id=job.user_id) then
  update private.account_deletions set status='complete',completed_at=now(),lease_id=null,leased_at=null where user_id=job.user_id;
  return true;
 end if;
 return job.status='complete' and job.completed_at>now()-interval '30 days';
end; $$;
create function public.release_account_deletion(p_owner uuid,p_lease uuid) returns void language sql security definer set search_path='' as $$
 update private.account_deletions set lease_id=null,leased_at=null where user_id=p_owner and lease_id=p_lease and status='pending';
$$;
revoke all on function public.begin_account_deletion(uuid,text,uuid), public.account_deletion_files(uuid,uuid),public.purge_account_data(uuid,uuid),public.finish_account_deletion(uuid,uuid),public.completed_account_deletion(text),public.release_account_deletion(uuid,uuid) from public,anon,authenticated;
grant execute on function public.begin_account_deletion(uuid,text,uuid), public.account_deletion_files(uuid,uuid),public.purge_account_data(uuid,uuid),public.finish_account_deletion(uuid,uuid),public.completed_account_deletion(text),public.release_account_deletion(uuid,uuid) to service_role;
