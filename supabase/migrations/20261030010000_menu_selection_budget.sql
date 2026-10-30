-- Private per-account menu selection lease. Every provider attempt is bounded, including failures.
create table private.menu_selection_jobs (
 user_id uuid primary key references auth.users(id) on delete cascade,
 input_hash text not null, contract_version text not null, lease_id uuid not null,
 started_at timestamptz not null, running boolean not null,
 result jsonb, generated_at timestamptz, attempt_day date not null,
 attempt_count integer not null check(attempt_count between 1 and 10)
);
alter table private.menu_selection_jobs enable row level security;
revoke all on private.menu_selection_jobs from public, anon, authenticated;
create function public.begin_menu_selection(p_owner uuid,p_hash text,p_version text,p_lease uuid) returns jsonb
language plpgsql security definer set search_path='' as $$
declare job private.menu_selection_jobs; moment timestamptz:=clock_timestamp(); today date:=(moment at time zone 'UTC')::date;
begin
 if p_owner is null or p_lease is null or p_hash is null or p_hash!~'^[a-f0-9]{64}$' or p_version is null or length(p_version) not between 1 and 200 or not exists(select 1 from auth.users where id=p_owner) then raise exception 'INVALID_MENU_RESERVATION';end if;
 perform pg_advisory_xact_lock(hashtextextended(p_owner::text||':menu-selection',0));
 select * into job from private.menu_selection_jobs where user_id=p_owner for update;
 if found then
  if job.input_hash=p_hash and job.contract_version=p_version and job.result is not null and job.generated_at>moment-interval '24 hours' then return jsonb_build_object('state','cached','result',job.result);end if;
  if job.running and job.started_at>moment-interval '90 seconds' then return jsonb_build_object('state','running');end if;
  if not job.running and job.result is null and job.started_at>moment-interval '30 seconds' then return jsonb_build_object('state','backoff');end if;
  if job.attempt_day=today and job.attempt_count>=10 then return jsonb_build_object('state','daily-limit');end if;
  if job.lease_id=p_lease then raise exception 'MENU_LEASE_REUSED';end if;
 end if;
 insert into private.menu_selection_jobs(user_id,input_hash,contract_version,lease_id,started_at,running,attempt_day,attempt_count)
 values(p_owner,p_hash,p_version,p_lease,moment,true,today,case when job.attempt_day=today then job.attempt_count+1 else 1 end)
 on conflict(user_id) do update set input_hash=excluded.input_hash,contract_version=excluded.contract_version,lease_id=excluded.lease_id,started_at=moment,running=true,result=null,generated_at=null,attempt_day=today,attempt_count=excluded.attempt_count;
 return jsonb_build_object('state','acquired');
end; $$;
create function public.finish_menu_selection(p_owner uuid,p_hash text,p_version text,p_lease uuid,p_result jsonb) returns boolean
language plpgsql security definer set search_path='' as $$
declare job private.menu_selection_jobs;
begin
 if p_result is not null and (jsonb_typeof(p_result)<>'object' or octet_length(p_result::text)>16000) then raise exception 'INVALID_MENU_SELECTION';end if;
 select * into job from private.menu_selection_jobs where user_id=p_owner for update;
 if not found or job.lease_id is distinct from p_lease or job.input_hash is distinct from p_hash or job.contract_version is distinct from p_version then return false;end if;
 if not job.running then return p_result is not null and job.result=p_result;end if;
 if job.started_at<=clock_timestamp()-interval '90 seconds' then return false;end if;
 update private.menu_selection_jobs set running=false,started_at=clock_timestamp(),result=p_result,generated_at=case when p_result is null then null else clock_timestamp() end where user_id=p_owner;
 return true;
end; $$;
revoke all on function public.begin_menu_selection(uuid,text,text,uuid),public.finish_menu_selection(uuid,text,text,uuid,jsonb) from public,anon,authenticated;
grant execute on function public.begin_menu_selection(uuid,text,text,uuid),public.finish_menu_selection(uuid,text,text,uuid,jsonb) to service_role;
