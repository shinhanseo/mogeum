-- Keep the same stored illustration across cellar, home and taste evidence. Hash remains sensory-input based.
create or replace function private.taste_snapshot(p_owner uuid) returns jsonb language sql stable security definer set search_path='' as $$
 with recent as (select * from public.tasting_records where user_id=p_owner order by consumed_at desc,id limit 200)
 select jsonb_build_object('hash',private.taste_input_hash(p_owner),
 'totalRecords',(select count(*) from public.tasting_records where user_id=p_owner),
 'omittedCount',greatest(0,(select count(*) from public.tasting_records where user_id=p_owner)-200),
 'records',coalesce(jsonb_agg(jsonb_build_object('id',r.id,'entryId',r.cellar_entry_id,'illustrationVariant',(select e.illustration_variant from public.cellar_entries e where e.id=r.cellar_entry_id and e.user_id=r.user_id),'revision',r.revision,'category',r.category,'name',r.entered_name,'date',r.consumed_at,'revisit',r.revisit,'rating',r.rating,
 'note',(select jsonb_build_object('mode',n.mode,'version',n.catalog_version,'inputRevision',n.input_revision,'confirmedInputRevision',n.confirmed_input_revision,'confirmed',n.confirmed_note is not null,'text',n.confirmed_note,
 'answers',coalesce((select jsonb_agg(jsonb_build_object('questionId',a.question_id,'status',a.status,'descriptorCodes',a.descriptor_codes) order by a.question_id) from public.record_answers a where a.user_id=p_owner and a.record_id=r.id and a.mode=n.mode and a.catalog_version=n.catalog_version),'[]'::jsonb))
 from public.record_notes n where n.user_id=p_owner and n.record_id=r.id)) order by r.consumed_at desc,r.id),'[]'::jsonb)) from recent r;
$$;
revoke all on function private.taste_snapshot(uuid) from public,anon,authenticated;
