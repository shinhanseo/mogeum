-- OCR originals and corrections remain separate. Photos stay on device in this first vertical slice.
create table public.menu_sessions (
 id uuid primary key,
 user_id uuid not null references auth.users(id) on delete cascade,
 revision integer not null default 1 check(revision>0),
 photos jsonb not null default '[]',
 items jsonb not null default '[]',
 updated_at timestamptz not null default now(),
 check(jsonb_typeof(photos)='array' and jsonb_array_length(photos)<=5),
 check(jsonb_typeof(items)='array' and jsonb_array_length(items)<=100)
);
alter table public.menu_sessions enable row level security;
create policy menu_sessions_read on public.menu_sessions for select to authenticated using(user_id=auth.uid());
revoke all on public.menu_sessions from anon,authenticated;
grant select on public.menu_sessions to authenticated;
create function public.save_menu_session(p_id uuid,p_revision integer,p_photos jsonb,p_items jsonb)
returns integer language plpgsql security definer set search_path='' as $$
declare current_revision integer; next_revision integer;
begin
 if auth.uid() is null or not private.active_user() then raise exception 'UNAUTHENTICATED';end if;
 if p_revision<0 or p_revision is null or p_id is null or p_photos is null or p_items is null
 or jsonb_typeof(p_photos)<>'array' or jsonb_array_length(p_photos)>5 or jsonb_typeof(p_items)<>'array' or jsonb_array_length(p_items)>100
 or pg_column_size(p_photos)>600000 or pg_column_size(p_items)>200000 then raise exception 'INVALID_MENU';end if;
 perform pg_advisory_xact_lock(hashtextextended(p_id::text,0));
 select revision into current_revision from public.menu_sessions where id=p_id and user_id=auth.uid();
 if current_revision is null then
  if p_revision<>0 or exists(select 1 from public.menu_sessions where id=p_id) then raise exception 'STALE_MENU';end if;
  insert into public.menu_sessions(id,user_id,photos,items) values(p_id,auth.uid(),p_photos,p_items);return 1;
 end if;
 -- Identical retry after a lost response returns its revision without a second write.
 if current_revision=p_revision+1 and exists(select 1 from public.menu_sessions where id=p_id and photos=p_photos and items=p_items) then return current_revision;end if;
 if current_revision<>p_revision then raise exception 'STALE_MENU';end if;
 next_revision=current_revision+1;
 update public.menu_sessions set revision=next_revision,photos=p_photos,items=p_items,updated_at=now() where id=p_id and user_id=auth.uid();
 return next_revision;
end $$;
revoke all on function public.save_menu_session(uuid,integer,jsonb,jsonb) from public,anon;
grant execute on function public.save_menu_session(uuid,integer,jsonb,jsonb) to authenticated;
