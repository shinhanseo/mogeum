-- Basic experience edits: keep the single-experience cellar label in sync atomically.
create function public.edit_tasting_record(p_record_id uuid,p_expected_revision integer,p_patch jsonb)
returns public.tasting_records language plpgsql security invoker set search_path='' as $$
declare result public.tasting_records;
begin
  -- Category changes require an explicit answer migration and are intentionally separate.
  if p_patch ? 'category' then raise exception 'Category changes require a separate flow' using errcode='22023'; end if;
  result := public.update_tasting_record(p_record_id,p_expected_revision,p_patch);
  perform 1 from public.cellar_entries where id=result.cellar_entry_id and user_id=auth.uid() for update;
  if p_patch ? 'enteredName' and (select count(*) from public.tasting_records where cellar_entry_id=result.cellar_entry_id)=1 then
    update public.cellar_entries set display_name=result.entered_name where id=result.cellar_entry_id and user_id=auth.uid();
  end if;
  return result;
end;
$$;
revoke all on function public.edit_tasting_record(uuid,integer,jsonb) from public,anon;
grant execute on function public.edit_tasting_record(uuid,integer,jsonb) to authenticated;

-- A client can acknowledge only its own job after Storage confirms the binary is gone.
create function public.complete_photo_deletion(p_job_id bigint) returns boolean
language plpgsql security definer set search_path='' as $$
declare job public.photo_deletion_jobs;
begin
  if auth.uid() is null or not private.active_user() then raise exception 'Authentication required' using errcode='42501'; end if;
  select * into job from public.photo_deletion_jobs where id=p_job_id and user_id=auth.uid() for update;
  if not found then raise exception 'Job not found' using errcode='42501'; end if;
  if exists(select 1 from storage.objects where bucket_id='record-photos' and name=job.storage_path) then return false; end if;
  update public.photo_deletion_jobs set status='done' where id=job.id;
  return true;
end;
$$;
revoke all on function public.complete_photo_deletion(bigint) from public,anon;
grant execute on function public.complete_photo_deletion(bigint) to authenticated;
