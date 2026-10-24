-- Record storage foundation. Managed auth/storage tables are not recreated here.
create schema if not exists private;
revoke all on schema private from public;
grant usage on schema private to authenticated;

create type public.drink_category as enum ('whisky', 'wine', 'beer', 'traditional', 'other');
create type public.revisit_choice as enum ('again', 'okay', 'not_for_me');
create type public.note_mode as enum ('light', 'deep');
create type public.answer_status as enum ('unanswered', 'skipped', 'unknown', 'none', 'answered');
create type public.vintage_status as enum ('year', 'nv', 'unknown');

create table public.profiles (
  user_id uuid primary key default auth.uid() references auth.users(id) on delete cascade,
  display_name text check (char_length(display_name) between 1 and 60),
  created_at timestamptz not null default now()
);
create table public.user_settings (
  user_id uuid primary key default auth.uid() references auth.users(id) on delete cascade,
  last_note_mode public.note_mode not null default 'light'
);
create table public.drinks (
  id uuid primary key default gen_random_uuid(),
  canonical_name text not null check (char_length(btrim(canonical_name)) between 1 and 200),
  category public.drink_category not null,
  producer text,
  aliases text[] not null default '{}',
  verification_status text not null default 'unverified' check (verification_status in ('unverified', 'verified'))
);
create table public.cellar_entries (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  drink_id uuid references public.drinks(id) on delete set null,
  display_name text check (char_length(btrim(display_name)) between 1 and 200),
  category public.drink_category,
  representative_photo_id uuid,
  created_at timestamptz not null default now(),
  unique (id, user_id)
);
create table public.tasting_records (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  cellar_entry_id uuid not null,
  operation_id uuid not null,
  create_payload jsonb not null default '{}' check (jsonb_typeof(create_payload) = 'object' and octet_length(create_payload::text) <= 16384),
  entered_name text check (char_length(btrim(entered_name)) between 1 and 200),
  category public.drink_category,
  consumed_at timestamptz not null default now(),
  revisit public.revisit_choice,
  rating smallint check (rating between 1 and 5),
  vintage_status public.vintage_status,
  vintage_year smallint,
  revision integer not null default 1 check (revision > 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, operation_id), unique (id, user_id),
  foreign key (cellar_entry_id, user_id) references public.cellar_entries(id, user_id) on delete restrict,
  check ((vintage_status is not distinct from 'year' and vintage_year is not null and vintage_year between 1 and 9999)
    or (vintage_status is distinct from 'year' and vintage_year is null)),
  check (category is not distinct from 'wine' or (vintage_status is null and vintage_year is null))
);
create index records_owner_date on public.tasting_records(user_id, consumed_at desc, id desc);
create index records_entry_date on public.tasting_records(cellar_entry_id, consumed_at desc);
create index entries_owner on public.cellar_entries(user_id);

create table public.record_photos (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  record_id uuid not null,
  storage_path text not null unique,
  width integer not null check (width between 1 and 20000),
  height integer not null check (height between 1 and 20000),
  sort_order integer not null default 0 check (sort_order >= 0),
  upload_status text not null default 'ready' check (upload_status in ('ready', 'missing')),
  unique (id, user_id), unique (record_id, user_id, sort_order),
  foreign key (record_id, user_id) references public.tasting_records(id, user_id) on delete cascade,
  check (split_part(storage_path, '/', 1) = user_id::text and split_part(storage_path, '/', 2) = 'records'
    and storage_path !~ '(^|/)\.\.?(/|$)' and char_length(storage_path) < 512)
);
alter table public.cellar_entries add constraint representative_photo_fk
  foreign key (representative_photo_id) references public.record_photos(id) on delete set null;
create index photos_record on public.record_photos(record_id);

create table public.record_notes (
  record_id uuid primary key,
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  mode public.note_mode not null,
  catalog_version integer not null check (catalog_version > 0),
  input_revision integer not null default 1 check (input_revision > 0),
  generated_draft text check (char_length(generated_draft) <= 10000),
  generated_input_revision integer check (generated_input_revision > 0 and generated_input_revision <= input_revision),
  confirmed_note text check (char_length(confirmed_note) <= 10000),
  edited_by_user boolean not null default false,
  foreign key (record_id, user_id) references public.tasting_records(id, user_id) on delete cascade,
  check ((generated_draft is null) = (generated_input_revision is null))
);
create table public.record_answers (
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  record_id uuid not null,
  mode public.note_mode not null,
  catalog_version integer not null check (catalog_version > 0),
  question_id text not null check (question_id ~ '^[a-z][a-z0-9_.-]{0,79}$'),
  status public.answer_status not null default 'unanswered',
  descriptor_codes text[] not null default '{}',
  intensity smallint check (intensity between 0 and 5),
  free_text text check (char_length(free_text) <= 2000),
  primary key (record_id, mode, catalog_version, question_id),
  foreign key (record_id, user_id) references public.tasting_records(id, user_id) on delete cascade,
  check (status = 'answered' or (cardinality(descriptor_codes) = 0 and intensity is null and free_text is null))
);
create table public.record_drafts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  record_id uuid,
  mode public.note_mode,
  schema_version integer not null default 1 check (schema_version > 0),
  payload jsonb not null default '{}' check (jsonb_typeof(payload) = 'object' and octet_length(payload::text) <= 131072),
  updated_at timestamptz not null default now(),
  foreign key (record_id, user_id) references public.tasting_records(id, user_id) on delete cascade
);
create index drafts_owner on public.record_drafts(user_id);
-- Retains owner ID after account removal so a server worker can still remove the binary.
create table public.photo_deletion_jobs (
  id bigint generated always as identity primary key,
  user_id uuid not null,
  storage_path text not null,
  status text not null default 'pending' check (status in ('pending', 'done', 'failed')),
  created_at timestamptz not null default now(),
  unique (user_id, storage_path)
);

create function private.active_user() returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (select 1 from auth.users where id = (select auth.uid()));
$$;
revoke all on function private.active_user() from public;
grant execute on function private.active_user() to authenticated;

-- Ownership and creation identity cannot be rewritten by a client UPDATE.
create function private.guard_identity() returns trigger
language plpgsql set search_path = '' as $$
begin
  if new.user_id is distinct from old.user_id then raise exception 'Immutable owner' using errcode = '23514'; end if;
  if to_jsonb(new)->'id' is distinct from to_jsonb(old)->'id' then raise exception 'Immutable ID' using errcode = '23514'; end if;
  if tg_table_name = 'record_photos' then
    if new.storage_path is distinct from old.storage_path then raise exception 'Immutable photo path' using errcode = '23514'; end if;
  end if;
  if tg_table_name = 'tasting_records' then
    if new.operation_id is distinct from old.operation_id or new.create_payload is distinct from old.create_payload
      or new.created_at is distinct from old.created_at then raise exception 'Immutable creation identity' using errcode = '23514'; end if;
    new.revision := old.revision + 1;
    new.updated_at := now();
  end if;
  return new;
end;
$$;

create function private.validate_photo() returns trigger
language plpgsql set search_path = '' as $$
begin
  if not exists (select 1 from storage.objects where bucket_id = 'record-photos' and name = new.storage_path) then
    raise exception 'Uploaded photo not found' using errcode = '23514';
  end if;
  return new;
end;
$$;
create trigger validate_record_photo before insert or update of storage_path on public.record_photos
for each row execute function private.validate_photo();

create function private.validate_representative() returns trigger
language plpgsql set search_path = '' as $$
begin
  if new.representative_photo_id is not null then
    perform 1 from public.record_photos p join public.tasting_records r on r.id = p.record_id and r.user_id = p.user_id
      where p.id = new.representative_photo_id and p.user_id = new.user_id and r.cellar_entry_id = new.id
      for share of p, r;
    if not found then raise exception 'Photo must belong to this cellar entry' using errcode = '23514'; end if;
  end if;
  return new;
end;
$$;
create trigger validate_entry_representative before insert or update on public.cellar_entries
for each row execute function private.validate_representative();

-- These trigger-only routines run as the migration owner to clean references even during cascades.
create function private.clear_representative_on_move() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if tg_table_name = 'tasting_records' then
    if old.cellar_entry_id is not distinct from new.cellar_entry_id then return new; end if;
    update public.cellar_entries set representative_photo_id = null
      where id = old.cellar_entry_id and user_id = old.user_id and representative_photo_id in
        (select id from public.record_photos where record_id = new.id and user_id = new.user_id);
  elsif tg_table_name = 'record_photos' then
    if old.record_id is not distinct from new.record_id then return new; end if;
    update public.cellar_entries set representative_photo_id = null
      where user_id = old.user_id and representative_photo_id = new.id;
  end if;
  return new;
end;
$$;
create trigger record_moved after update of cellar_entry_id on public.tasting_records
for each row execute function private.clear_representative_on_move();
create trigger photo_moved after update of record_id on public.record_photos
for each row execute function private.clear_representative_on_move();

create function private.enqueue_photo_deletion() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  insert into public.photo_deletion_jobs(user_id, storage_path) values (old.user_id, old.storage_path)
    on conflict (user_id, storage_path) do update set status = 'pending';
  return old;
end;
$$;
create trigger photo_deleted after delete on public.record_photos
for each row execute function private.enqueue_photo_deletion();

-- Every private child uses a composite owner FK in addition to RLS.
do $$
declare table_name text;
begin
  foreach table_name in array array['profiles', 'user_settings', 'cellar_entries', 'tasting_records', 'record_photos', 'record_notes', 'record_answers', 'record_drafts'] loop
    execute format('alter table public.%I enable row level security', table_name);
    execute format('create policy owner_access on public.%I for all to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id)', table_name);
    execute format('revoke all on public.%I from anon, authenticated', table_name);
    execute format('grant select, insert, update, delete on public.%I to authenticated', table_name);
    execute format('create trigger guard_identity before update on public.%I for each row execute function private.guard_identity()', table_name);
  end loop;
end;
$$;
alter table public.drinks enable row level security;
create policy verified_catalog on public.drinks for select to authenticated using (verification_status = 'verified');
revoke all on public.drinks from anon, authenticated;
grant select on public.drinks to authenticated;
alter table public.photo_deletion_jobs enable row level security;
create policy own_deletion_status on public.photo_deletion_jobs for select to authenticated using ((select auth.uid()) = user_id);
revoke all on public.photo_deletion_jobs from anon, authenticated;
grant select on public.photo_deletion_jobs to authenticated;
revoke all on all functions in schema private from public;
grant execute on function private.active_user() to authenticated;

insert into storage.buckets(id, name, public, file_size_limit, allowed_mime_types)
values ('record-photos', 'record-photos', false, 10485760, array['image/jpeg','image/png','image/webp','image/heic']);
create policy record_photo_read on storage.objects for select to authenticated
using (bucket_id = 'record-photos' and (storage.foldername(name))[1] = (select auth.uid())::text and (select private.active_user()));
create policy record_photo_upload on storage.objects for insert to authenticated
with check (bucket_id = 'record-photos' and (storage.foldername(name))[1] = (select auth.uid())::text
  and (storage.foldername(name))[2] = 'records' and name !~ '(^|/)\.\.?(/|$)' and (select private.active_user()));
-- No overwrite/upsert policy. New uploads always use new paths.
create policy orphan_photo_delete on storage.objects for delete to authenticated
using (bucket_id = 'record-photos' and (storage.foldername(name))[1] = (select auth.uid())::text
  and (select private.active_user()) and not exists (select 1 from public.record_photos p where p.storage_path = name));
