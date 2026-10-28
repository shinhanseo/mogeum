-- Keep the five-attempt UTC daily budget; expose precise reasons without charging a new attempt.
create or replace function public.begin_taste_summary(p_owner uuid,p_hash text,p_lease uuid) returns text language plpgsql security definer set search_path='' as $$
declare job private.taste_summary_jobs; utc_day date:=(now() at time zone 'UTC')::date;
begin
 if p_owner is null or p_lease is null or not exists(select 1 from auth.users where id=p_owner) then raise exception 'Inactive owner' using errcode='42501'; end if;
 perform pg_advisory_xact_lock(hashtextextended(p_owner::text||':taste-summary',0));
 if p_hash is distinct from private.taste_input_hash(p_owner) then return 'stale'; end if;
 select * into job from private.taste_summary_jobs where user_id=p_owner for update;
 if found then
  if job.input_hash=p_hash and job.status='ready' then return 'cached'; end if;
  if job.status='running' and job.started_at>now()-interval '90 seconds' then return 'running'; end if;
  if job.call_day=utc_day and job.daily_calls>=5 then return 'daily-limit';end if;
  if job.started_at>now()-interval '20 seconds' then return 'cooldown';end if;
 end if;
 insert into private.taste_summary_jobs(user_id,input_hash,lease_id,status,started_at,call_day,daily_calls)
 values(p_owner,p_hash,p_lease,'running',now(),utc_day,case when job.call_day=utc_day then job.daily_calls+1 else 1 end)
 on conflict(user_id) do update set input_hash=excluded.input_hash,lease_id=excluded.lease_id,status='running',started_at=now(),call_day=utc_day,daily_calls=excluded.daily_calls,result=null,generated_at=null;
 return 'acquired';
end; $$;
