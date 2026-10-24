-- Preserve the selected representative while temporarily unavailable; fall back to a ready photo.
create or replace view public.cellar_overview with (security_invoker = true) as
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
  and representative.user_id = e.user_id and representative.upload_status = 'ready'
  and exists (select 1 from public.tasting_records rr where rr.id = representative.record_id
    and rr.cellar_entry_id = e.id and rr.user_id = e.user_id)
left join lateral (select p.storage_path from public.record_photos p join public.tasting_records r on r.id = p.record_id
  where r.cellar_entry_id = e.id and r.user_id = e.user_id
    and p.user_id = e.user_id and p.upload_status = 'ready' order by r.consumed_at desc, r.id desc, p.sort_order limit 1) fallback on true;
revoke all on public.cellar_overview from anon, authenticated;
grant select on public.cellar_overview to authenticated;
