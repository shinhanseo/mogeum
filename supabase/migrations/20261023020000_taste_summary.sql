-- Cached results and processing leases are server-owned. Client reads are always checked against current input.
create table private.taste_summary_jobs (
 user_id uuid primary key references auth.users(id) on delete cascade,
 input_hash text not null, lease_id uuid, status text not null check(status in('running','ready','failed')),
 started_at timestamptz not null default now(), generated_at timestamptz,
 result jsonb, call_day date not null default current_date, daily_calls integer not null default 0,
 check(result is null or jsonb_typeof(result)='object' and octet_length(result::text)<=16384)
);
alter table private.taste_summary_jobs enable row level security;
revoke all on private.taste_summary_jobs from public,anon,authenticated;

create function private.taste_input_hash(p_owner uuid) returns text language sql stable security definer set search_path='' as $$
 select md5('taste-v1:'||coalesce(string_agg(id::text||':'||revision::text,',' order by id),'')) from public.tasting_records where user_id=p_owner;
$$;
revoke all on function private.taste_input_hash(uuid) from public,anon,authenticated;

create function private.taste_snapshot(p_owner uuid) returns jsonb language sql stable security definer set search_path='' as $$
 with recent as (select * from public.tasting_records where user_id=p_owner order by consumed_at desc,id limit 200)
 select jsonb_build_object('hash',private.taste_input_hash(p_owner),
 'totalRecords',(select count(*) from public.tasting_records where user_id=p_owner),
 'omittedCount',greatest(0,(select count(*) from public.tasting_records where user_id=p_owner)-200),
 'records',coalesce(jsonb_agg(jsonb_build_object('id',r.id,'entryId',r.cellar_entry_id,'revision',r.revision,'category',r.category,'name',r.entered_name,'date',r.consumed_at,'revisit',r.revisit,'rating',r.rating,
 'note',(select jsonb_build_object('mode',n.mode,'version',n.catalog_version,'inputRevision',n.input_revision,'confirmedInputRevision',n.confirmed_input_revision,'confirmed',n.confirmed_note is not null,'text',n.confirmed_note,
 'answers',coalesce((select jsonb_agg(jsonb_build_object('questionId',a.question_id,'status',a.status,'descriptorCodes',a.descriptor_codes) order by a.question_id) from public.record_answers a where a.user_id=p_owner and a.record_id=r.id and a.mode=n.mode and a.catalog_version=n.catalog_version),'[]'::jsonb))
 from public.record_notes n where n.user_id=p_owner and n.record_id=r.id)) order by r.consumed_at desc,r.id),'[]'::jsonb)) from recent r;
$$;
revoke all on function private.taste_snapshot(uuid) from public,anon,authenticated;

create function public.taste_summary_context() returns jsonb language plpgsql security definer set search_path='' as $$
declare owner_id uuid:=auth.uid(); snapshot jsonb; job private.taste_summary_jobs;
begin
 if owner_id is null or not private.active_user() then raise exception 'Authentication required' using errcode='42501'; end if;
 snapshot:=private.taste_snapshot(owner_id);
 select * into job from private.taste_summary_jobs where user_id=owner_id;
 return jsonb_build_object('snapshot',snapshot,'cached',case when job.input_hash=snapshot->>'hash' and job.status='ready' then job.result else null end,
 'stale',coalesce(job.input_hash<>snapshot->>'hash',false),'running',coalesce(job.status='running' and job.started_at>now()-interval '90 seconds',false));
end; $$;
revoke all on function public.taste_summary_context() from public,anon;
grant execute on function public.taste_summary_context() to authenticated;

-- Only the verified Edge Function may acquire a lease or publish model selections.
create function public.begin_taste_summary(p_owner uuid,p_hash text,p_lease uuid) returns text language plpgsql security definer set search_path='' as $$
declare job private.taste_summary_jobs;
begin
 if p_owner is null or p_lease is null or not exists(select 1 from auth.users where id=p_owner) then raise exception 'Inactive owner' using errcode='42501'; end if;
 perform pg_advisory_xact_lock(hashtextextended(p_owner::text||':taste-summary',0));
 if p_hash is distinct from private.taste_input_hash(p_owner) then return 'stale'; end if;
 select * into job from private.taste_summary_jobs where user_id=p_owner for update;
 if found then
  if job.input_hash=p_hash and job.status='ready' then return 'cached'; end if;
  if job.status='running' and job.started_at>now()-interval '90 seconds' then return 'running'; end if;
  if job.call_day=current_date and job.daily_calls>=5 or job.started_at>now()-interval '20 seconds' then return 'limited'; end if;
 end if;
 insert into private.taste_summary_jobs(user_id,input_hash,lease_id,status,started_at,call_day,daily_calls)
 values(p_owner,p_hash,p_lease,'running',now(),current_date,case when job.call_day=current_date then job.daily_calls+1 else 1 end)
 on conflict(user_id) do update set input_hash=excluded.input_hash,lease_id=excluded.lease_id,status='running',started_at=now(),call_day=current_date,daily_calls=excluded.daily_calls,result=null,generated_at=null;
 return 'acquired';
end; $$;
create function public.finish_taste_summary(p_owner uuid,p_hash text,p_lease uuid,p_result jsonb) returns boolean language plpgsql security definer set search_path='' as $$
begin
 perform pg_advisory_xact_lock(hashtextextended(p_owner::text||':taste-summary',0));
 if p_hash is distinct from private.taste_input_hash(p_owner) then
  update private.taste_summary_jobs set status='failed' where user_id=p_owner and lease_id=p_lease; return false;
 end if;
 if p_result is not null and (jsonb_typeof(p_result)<>'object' or p_result->>'version' is distinct from 'taste-v1' or jsonb_typeof(p_result->'selection') is distinct from 'object') then raise exception 'Invalid summary' using errcode='22023'; end if;
 update private.taste_summary_jobs set result=p_result,status=case when p_result is null then 'failed' else 'ready' end,generated_at=case when p_result is null then null else now() end where user_id=p_owner and lease_id=p_lease and input_hash=p_hash and status='running';
 return found;
end; $$;
revoke all on function public.begin_taste_summary(uuid,text,uuid),public.finish_taste_summary(uuid,text,uuid,jsonb) from public,anon,authenticated;
grant execute on function public.begin_taste_summary(uuid,text,uuid),public.finish_taste_summary(uuid,text,uuid,jsonb) to service_role;
