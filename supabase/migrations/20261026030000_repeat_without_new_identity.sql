-- A linked experience already has an explicit cellar identity. New entries still require a name or photo.
create or replace function public.create_tasting_record(p_operation_id uuid, p_record jsonb, p_entry_id uuid default null)
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
  if exists(select 1 from public.deleted_record_operations where user_id=caller and operation_id=p_operation_id) then
    raise exception 'Record was deleted' using errcode='P0002';
  end if;
  select * into existing from public.tasting_records where user_id = caller and operation_id = p_operation_id;
  if found then
    if existing.create_payload is distinct from payload then raise exception 'Operation ID used for another input' using errcode = '23505'; end if;
    return jsonb_build_object('recordId', existing.id, 'cellarEntryId', existing.cellar_entry_id, 'revision', existing.revision, 'replayed', true);
  end if;
  if entry_id is null and entered_name is null and (photo is null or photo = 'null'::jsonb) then raise exception 'A name or photo is required' using errcode = '22023'; end if;
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
