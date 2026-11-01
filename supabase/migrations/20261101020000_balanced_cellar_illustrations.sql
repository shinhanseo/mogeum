-- Store an illustrative choice, not an inferred beer style or product fact.
alter table public.cellar_entries add column illustration_variant smallint check (illustration_variant between 0 and 3);
with ranked as (
 select id, ((row_number() over (partition by user_id, category order by created_at,id)-1)%4)::smallint variant
 from public.cellar_entries
) update public.cellar_entries e set illustration_variant=r.variant from ranked r where r.id=e.id;
create function private.assign_cellar_illustration() returns trigger language plpgsql security definer set search_path='' as $$
begin
 if new.illustration_variant is null then
  perform pg_advisory_xact_lock(hashtextextended('mogeum:illustration:'||new.user_id::text,0));
  select v into new.illustration_variant from generate_series(0,3) v
  order by (select count(*) from public.cellar_entries e where e.user_id=new.user_id and e.category is not distinct from new.category and e.illustration_variant=v),v limit 1;
 end if;
 return new;
end; $$;
revoke all on function private.assign_cellar_illustration() from public,anon,authenticated;
create trigger assign_cellar_illustration before insert on public.cellar_entries for each row execute function private.assign_cellar_illustration();
alter table public.cellar_entries alter column illustration_variant set not null;

create or replace view public.cellar_overview with (security_invoker = true) as
select e.id, e.user_id, e.drink_id,
  coalesce(e.display_name, latest.entered_name, d.canonical_name) as display_name,
  coalesce(e.category, latest.category, d.category) as category,
  (select count(*) from public.tasting_records r where r.cellar_entry_id = e.id) as record_count,
  latest.consumed_at as last_consumed_at, latest.revisit,
  coalesce(representative.storage_path, fallback.storage_path) as photo_path, e.illustration_variant
from public.cellar_entries e
join lateral (select r.* from public.tasting_records r where r.cellar_entry_id = e.id order by consumed_at desc, id desc limit 1) latest on true
left join public.drinks d on d.id = e.drink_id
left join public.record_photos representative on representative.id = e.representative_photo_id
  and representative.user_id = e.user_id and representative.upload_status = 'ready'
  and exists (select 1 from public.tasting_records rr where rr.id = representative.record_id
    and rr.cellar_entry_id = e.id and rr.user_id = e.user_id)
left join lateral (select p.storage_path from public.record_photos p join public.tasting_records r on r.id = p.record_id
  where r.cellar_entry_id = e.id and r.user_id = e.user_id
    and p.user_id = e.user_id and p.upload_status = 'ready' order by r.consumed_at desc, r.id desc, p.sort_order limit 1) fallback on true;
revoke all on public.cellar_overview from anon, authenticated;
grant select on public.cellar_overview to authenticated;
