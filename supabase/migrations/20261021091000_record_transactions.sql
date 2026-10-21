-- RLS remains active inside these invoker functions. No client-supplied owner IDs.
create function public.create_tasting_record(p_operation_id uuid, p_record jsonb, p_entry_id uuid default null)
returns jsonb language plpgsql security invoker set search_path = '' as $$
declare
  caller uuid := auth.uid();
  payload jsonb := jsonb_build_object('entryId', p_entry_id, 'record', p_record);
  existing public.tasting_records;
  entry_id uuid := p_entry_id;
  record_id uuid;
  photo_id uuid;
  entered_name text := nullif(btrim(p_record->>'enteredName'), '');
  category public.drink_category := (p_record->>'category')::public.drink_category;
  photo jsonb := p_record->'photo';
begin
  if caller is null or not private.active_user() then raise exception 'Authentication required' using errcode = '42501'; end if;
  if p_operation_id is null or p_record is null or jsonb_typeof(p_record) <> 'object'
    or octet_length(p_record::text) > 16384 then raise exception 'Invalid record input' using errcode = '22023'; end if;
  if p_record - array['enteredName','category','consumedAt','revisit','rating','vintageStatus','vintageYear','photo'] <> '{}'::jsonb then
    raise exception 'Unknown record fields' using errcode = '22023';
  end if;
  -- Serializes concurrent retries before creating a cellar entry (not just the record row).
  perform pg_advisory_xact_lock(hashtextextended(caller::text || ':' || p_operation_id::text, 0));
  select * into existing from public.tasting_records where user_id = caller and operation_id = p_operation_id;
  if found then
    if existing.create_payload is distinct from payload then raise exception 'Operation ID used for another input' using errcode = '23505'; end if;
    return jsonb_build_object('recordId', existing.id, 'cellarEntryId', existing.cellar_entry_id, 'revision', existing.revision, 'replayed', true);
  end if;
  if entered_name is null and (photo is null or photo = 'null'::jsonb) then raise exception 'A name or photo is required' using errcode = '22023'; end if;
  if entry_id is null then
    insert into public.cellar_entries(user_id, display_name, category) values (caller, entered_name, category) returning id into entry_id;
  else
    perform 1 from public.cellar_entries where id = entry_id and user_id = caller for update;
    if not found then raise exception 'Cellar entry not found' using errcode = '42501'; end if;
  end if;
  insert into public.tasting_records(user_id, cellar_entry_id, operation_id, create_payload, entered_name, category, consumed_at, revisit, rating, vintage_status, vintage_year)
  values (caller, entry_id, p_operation_id, payload, entered_name, category, coalesce((p_record->>'consumedAt')::timestamptz, now()),
    (p_record->>'revisit')::public.revisit_choice, (p_record->>'rating')::smallint,
    (p_record->>'vintageStatus')::public.vintage_status, (p_record->>'vintageYear')::smallint)
  returning id into record_id;
  if photo is not null and photo <> 'null'::jsonb then
    if jsonb_typeof(photo) <> 'object' or photo - array['storagePath','width','height'] <> '{}'::jsonb then
      raise exception 'Invalid photo input' using errcode = '22023';
    end if;
    insert into public.record_photos(user_id, record_id, storage_path, width, height)
    values (caller, record_id, photo->>'storagePath', (photo->>'width')::integer, (photo->>'height')::integer) returning id into photo_id;
    update public.cellar_entries set representative_photo_id = photo_id where id = entry_id and representative_photo_id is null;
  end if;
  return jsonb_build_object('recordId', record_id, 'cellarEntryId', entry_id,
    'revision', (select revision from public.tasting_records where id = record_id), 'replayed', false);
end;
$$;

create function public.update_tasting_record(p_record_id uuid, p_expected_revision integer, p_patch jsonb)
returns public.tasting_records language plpgsql security invoker set search_path = '' as $$
declare existing public.tasting_records; result public.tasting_records;
begin
  if auth.uid() is null then raise exception 'Authentication required' using errcode = '42501'; end if;
  if p_patch is null or jsonb_typeof(p_patch) <> 'object' or
    p_patch - array['enteredName','category','consumedAt','revisit','rating','vintageStatus','vintageYear'] <> '{}'::jsonb then
    raise exception 'Invalid patch' using errcode = '22023';
  end if;
  select * into existing from public.tasting_records where id = p_record_id and user_id = auth.uid() for update;
  if not found then raise exception 'Record not found' using errcode = '42501'; end if;
  if p_expected_revision is distinct from existing.revision then raise exception 'Record changed; reload before editing' using errcode = '40001'; end if;
  update public.tasting_records set
    entered_name = case when p_patch ? 'enteredName' then nullif(btrim(p_patch->>'enteredName'), '') else entered_name end,
    category = case when p_patch ? 'category' then (p_patch->>'category')::public.drink_category else category end,
    consumed_at = case when p_patch ? 'consumedAt' then (p_patch->>'consumedAt')::timestamptz else consumed_at end,
    revisit = case when p_patch ? 'revisit' then (p_patch->>'revisit')::public.revisit_choice else revisit end,
    rating = case when p_patch ? 'rating' then (p_patch->>'rating')::smallint else rating end,
    vintage_status = case when p_patch ? 'vintageStatus' then (p_patch->>'vintageStatus')::public.vintage_status else vintage_status end,
    vintage_year = case when p_patch ? 'vintageYear' then (p_patch->>'vintageYear')::smallint else vintage_year end
    where id = p_record_id returning * into result;
  return result;
end;
$$;

create function public.move_tasting_record(p_record_id uuid, p_entry_id uuid, p_expected_revision integer)
returns public.tasting_records language plpgsql security invoker set search_path = '' as $$
declare existing public.tasting_records; result public.tasting_records;
begin
  select * into existing from public.tasting_records where id = p_record_id and user_id = auth.uid() for update;
  if not found then raise exception 'Record not found' using errcode = '42501'; end if;
  if p_expected_revision is distinct from existing.revision then raise exception 'Record changed; reload before moving' using errcode = '40001'; end if;
  perform 1 from public.cellar_entries where id = p_entry_id and user_id = auth.uid() for update;
  if not found then raise exception 'Cellar entry not found' using errcode = '42501'; end if;
  update public.tasting_records set cellar_entry_id = p_entry_id where id = p_record_id returning * into result;
  return result;
end;
$$;

-- Never expose empty entries, and count experiences rather than assuming a name is a product identity.
create view public.cellar_overview with (security_invoker = true) as
select e.id, e.user_id, e.drink_id,
  coalesce(e.display_name, latest.entered_name, d.canonical_name) as display_name,
  coalesce(e.category, latest.category, d.category) as category,
  (select count(*) from public.tasting_records r where r.cellar_entry_id = e.id) as record_count,
  latest.consumed_at as last_consumed_at, latest.revisit,
  coalesce(representative.storage_path, fallback.storage_path) as photo_path
from public.cellar_entries e
join lateral (select r.* from public.tasting_records r where r.cellar_entry_id = e.id order by consumed_at desc, id desc limit 1) latest on true
left join public.drinks d on d.id = e.drink_id
left join public.record_photos representative on representative.id = e.representative_photo_id
left join lateral (select p.storage_path from public.record_photos p join public.tasting_records r on r.id = p.record_id
  where r.cellar_entry_id = e.id order by r.consumed_at desc, r.id desc, p.sort_order limit 1) fallback on true;
revoke all on public.cellar_overview from anon;
grant select on public.cellar_overview to authenticated;
revoke all on function public.create_tasting_record(uuid, jsonb, uuid) from public, anon;
revoke all on function public.update_tasting_record(uuid, integer, jsonb) from public, anon;
revoke all on function public.move_tasting_record(uuid, uuid, integer) from public, anon;
grant execute on function public.create_tasting_record(uuid, jsonb, uuid) to authenticated;
grant execute on function public.update_tasting_record(uuid, integer, jsonb) to authenticated;
grant execute on function public.move_tasting_record(uuid, uuid, integer) to authenticated;

create function private.touch_record_from_child() returns trigger
language plpgsql security definer set search_path = '' as $$
declare target_id uuid; owner_id uuid;
begin
  if tg_op = 'DELETE' then target_id := old.record_id; owner_id := old.user_id;
  else target_id := new.record_id; owner_id := new.user_id; end if;
  update public.tasting_records set updated_at = now() where id = target_id and user_id = owner_id;
  if tg_op = 'UPDATE' then
    if old.record_id is distinct from new.record_id then
      update public.tasting_records set updated_at = now() where id = old.record_id and user_id = old.user_id;
    end if;
  end if;
  if tg_table_name = 'record_answers' then
    update public.record_notes set input_revision = input_revision + 1 where record_id = target_id and user_id = owner_id;
  end if;
  if tg_op = 'DELETE' then return old; else return new; end if;
end;
$$;
create trigger photo_record_revision after insert or update or delete on public.record_photos
for each row execute function private.touch_record_from_child();
create trigger note_record_revision after insert or update or delete on public.record_notes
for each row execute function private.touch_record_from_child();
create trigger answer_record_revision after insert or update or delete on public.record_answers
for each row execute function private.touch_record_from_child();
revoke all on function private.touch_record_from_child() from public;
-- Generated prose is written only by a later server operation, not a client claiming an AI result.
revoke insert, update on public.record_notes from authenticated;
grant insert (record_id,user_id,mode,catalog_version,input_revision,confirmed_note,edited_by_user) on public.record_notes to authenticated;
grant update (mode,catalog_version,confirmed_note,edited_by_user) on public.record_notes to authenticated;
