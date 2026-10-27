-- Group deletion retains only IDs for safe response-loss retries, never note/photo content.
create table private.deleted_cellar_entries (
 entry_id uuid primary key,
 user_id uuid not null references auth.users(id) on delete cascade,
 record_ids uuid[] not null,
 deleted_at timestamptz not null default now()
);
alter table private.deleted_cellar_entries enable row level security;
revoke all on private.deleted_cellar_entries from public,anon,authenticated;

create function private.cellar_delete_state(p_entry uuid,p_owner uuid) returns jsonb
language sql security definer set search_path='' as $$
 select jsonb_build_object('entryId',e.id,'name',e.display_name,'count',count(r.id),
  'latestRecordId',(array_agg(r.id order by r.consumed_at desc,r.id))[1],
  'snapshot',md5(jsonb_build_array(e.display_name,e.category,
   coalesce(string_agg(r.id::text||':'||r.revision::text,',' order by r.id),''))::text),'deleted',false)
 from public.cellar_entries e left join public.tasting_records r on r.cellar_entry_id=e.id and r.user_id=e.user_id
 where e.id=p_entry and e.user_id=p_owner group by e.id;
$$;
revoke all on function private.cellar_delete_state(uuid,uuid) from public,anon,authenticated;

create function public.cellar_deletion_context(p_entry_id uuid) returns jsonb
language plpgsql security definer set search_path='' as $$
declare caller uuid:=auth.uid(); result jsonb;
begin
 if caller is null then raise exception 'Authentication required' using errcode='42501'; end if;
 result:=private.cellar_delete_state(p_entry_id,caller);
 if result is not null then return result; end if;
 if exists(select 1 from private.deleted_cellar_entries where entry_id=p_entry_id and user_id=caller) then
  return jsonb_build_object('entryId',p_entry_id,'deleted',true);
 end if;
 raise exception 'Entry unavailable' using errcode='P0002';
end; $$;
revoke all on function public.cellar_deletion_context(uuid) from public,anon;
grant execute on function public.cellar_deletion_context(uuid) to authenticated;

create function public.delete_cellar_entry(p_entry_id uuid,p_expected_snapshot text) returns jsonb
language plpgsql security definer set search_path='' as $$
declare caller uuid:=auth.uid(); result jsonb; ids uuid[];
begin
 if caller is null then raise exception 'Authentication required' using errcode='42501'; end if;
 if p_entry_id is null or p_expected_snapshot is null or p_expected_snapshot !~ '^[a-f0-9]{32}$' then
  raise exception 'Invalid deletion request' using errcode='22023';
 end if;
 if not private.account_writable(caller) then raise exception 'ACCOUNT_DELETING' using errcode='42501'; end if;
 perform 1 from public.cellar_entries where id=p_entry_id and user_id=caller for update;
 if not found then
  select record_ids into ids from private.deleted_cellar_entries where entry_id=p_entry_id and user_id=caller;
  if found then return jsonb_build_object('recordIds',ids,'replayed',true); end if;
  raise exception 'Entry unavailable' using errcode='P0002';
 end if;
 -- Block concurrent edits/deletes and FK inserts/moves before checking what the user confirmed.
 perform 1 from public.tasting_records where cellar_entry_id=p_entry_id and user_id=caller order by id for update;
 result:=private.cellar_delete_state(p_entry_id,caller);
 if result->>'snapshot' is distinct from p_expected_snapshot then
  raise exception 'Entry changed; confirm current records again' using errcode='40001';
 end if;
 select coalesce(array_agg(id order by id),'{}'::uuid[]) into ids from public.tasting_records where cellar_entry_id=p_entry_id and user_id=caller;
 insert into private.deleted_cellar_entries(entry_id,user_id,record_ids) values(p_entry_id,caller,ids);
 -- Existing cascade/tombstone/photo-deletion triggers also run for every experience.
 delete from public.tasting_records where cellar_entry_id=p_entry_id and user_id=caller;
 delete from public.cellar_entries where id=p_entry_id and user_id=caller;
 return jsonb_build_object('recordIds',ids,'replayed',false);
end; $$;
revoke all on function public.delete_cellar_entry(uuid,text) from public,anon;
grant execute on function public.delete_cellar_entry(uuid,text) to authenticated;
