-- Private receipts make photo replacement / explicit regrouping safe across lost responses.
create table private.record_attachment_receipts (
 user_id uuid not null references auth.users(id) on delete cascade,
 operation_id uuid not null,
 payload jsonb not null,
 result jsonb not null,
 primary key(user_id,operation_id)
);
revoke all on private.record_attachment_receipts from public,anon,authenticated;

create function public.change_record_attachment(p_record_id uuid,p_operation_id uuid,p_expected_revision integer,p_change jsonb)
returns jsonb language plpgsql security definer set search_path='' as $$
declare
 caller uuid:=auth.uid(); original public.tasting_records; previous private.record_attachment_receipts;
 payload jsonb:=jsonb_build_object('recordId',p_record_id,'revision',p_expected_revision,'change',p_change);
 target uuid; old_photo public.record_photos; new_photo uuid; current_rep uuid; output jsonb; kind text:=p_change->>'kind';
begin
 if caller is null or not private.active_user() then raise exception 'Authentication required' using errcode='42501'; end if;
 if p_operation_id is null or p_record_id is null or p_change is null or jsonb_typeof(p_change)<>'object' or octet_length(p_change::text)>16384 then
   raise exception 'Invalid change' using errcode='22023';
 end if;
 perform pg_advisory_xact_lock(hashtextextended(caller::text || ':attachment:' || p_operation_id::text,0));
 select * into previous from private.record_attachment_receipts where user_id=caller and operation_id=p_operation_id;
 if found then
   if previous.payload is distinct from payload then raise exception 'Operation ID used for another change' using errcode='23505'; end if;
   return previous.result || jsonb_build_object('replayed',true);
 end if;
 select * into original from public.tasting_records where id=p_record_id and user_id=caller for update;
 if not found then raise exception 'Record not found' using errcode='P0002'; end if;
 if original.revision is distinct from p_expected_revision then raise exception 'Record changed' using errcode='40001'; end if;
 if kind='photo' then
   if p_change-array['kind','storagePath','width','height']<>'{}'::jsonb or
      p_change->>'storagePath' is distinct from caller::text || '/records/' || p_operation_id::text || '/photo.jpg' or p_change->>'width' is null or p_change->>'height' is null then
     raise exception 'Invalid photo' using errcode='22023';
   end if;
   perform 1 from public.cellar_entries where id=original.cellar_entry_id and user_id=caller for update;
   select representative_photo_id into current_rep from public.cellar_entries where id=original.cellar_entry_id;
   select * into old_photo from public.record_photos where record_id=original.id and user_id=caller order by sort_order,id limit 1;
   if found then
     delete from public.record_photos where id=old_photo.id and user_id=caller;
   end if;
   insert into public.record_photos(user_id,record_id,storage_path,width,height,sort_order)
    values(caller,original.id,p_change->>'storagePath',(p_change->>'width')::integer,(p_change->>'height')::integer,coalesce(old_photo.sort_order,0)) returning id into new_photo;
   if current_rep is null or current_rep=old_photo.id then
     update public.cellar_entries set representative_photo_id=new_photo where id=original.cellar_entry_id and user_id=caller;
   end if;
   target:=original.cellar_entry_id;
 elsif kind='move' or kind='split' then
   if kind='move' then
     if p_change-array['kind','entryId']<>'{}'::jsonb or p_change->>'entryId' is null then raise exception 'Invalid target' using errcode='22023'; end if;
     target:=(p_change->>'entryId')::uuid;
     -- Deterministic group lock ordering for simultaneous moves between the same two groups.
     perform 1 from public.cellar_entries where user_id=caller and id in(original.cellar_entry_id,target) order by id for update;
     if not exists(select 1 from public.cellar_entries where id=target and user_id=caller) then raise exception 'Target not found' using errcode='42501'; end if;
     if target=original.cellar_entry_id then raise exception 'Already in this cellar entry' using errcode='22023'; end if;
   else
     if p_change-array['kind','name']<>'{}'::jsonb or (p_change->'name' is not null and jsonb_typeof(p_change->'name') not in ('string','null')) or length(p_change->>'name')>200 then raise exception 'Invalid split' using errcode='22023'; end if;
     perform 1 from public.cellar_entries where id=original.cellar_entry_id and user_id=caller for update;
     insert into public.cellar_entries(user_id,display_name,category) values(caller,nullif(btrim(p_change->>'name'),''),original.category) returning id into target;
   end if;
   update public.tasting_records set cellar_entry_id=target where id=original.id and user_id=caller;
 else
   raise exception 'Unknown change kind' using errcode='22023';
 end if;
 output:=jsonb_build_object('recordId',original.id,'cellarEntryId',target,'revision',(select revision from public.tasting_records where id=original.id),'replayed',false);
 insert into private.record_attachment_receipts(user_id,operation_id,payload,result) values(caller,p_operation_id,payload,output);
 return output;
end;
$$;
revoke all on function public.change_record_attachment(uuid,uuid,integer,jsonb) from public,anon;
grant execute on function public.change_record_attachment(uuid,uuid,integer,jsonb) to authenticated;
