-- Reuse product IDs within the weekly window; never reuse old personal explanations.
create or replace function public.begin_discovery_generation(p_user uuid,p_hash text,p_version text,p_lease uuid) returns jsonb
language plpgsql security definer set search_path='' as $$
declare job private.discovery_generations; moment timestamptz:=clock_timestamp();
begin
 if p_user is null or p_hash is null or p_hash !~ '^[0-9a-f]{64}$' or p_version is null or length(p_version) not between 1 and 100 or p_lease is null then raise exception 'INVALID_DISCOVERY_JOB';end if;
 -- User-level lock prevents per-category/device/key bypass; category is deliberately absent.
 perform pg_advisory_xact_lock(hashtextextended('mogeum:discovery:'||p_user::text,0));
 select * into job from private.discovery_generations where user_id=p_user for update;
 if found then
  if job.next_generation_at>moment then
   if job.contract_version=p_version then
    return jsonb_build_object('state','cached','result',job.result,'generatedAt',job.generated_at,'nextGenerationAt',job.next_generation_at);
   end if;
   -- A changed contract cannot reuse the receipt; changed records are revalidated by restoreWeeklyDrinks.
   return jsonb_build_object('state','invalidated','nextGenerationAt',job.next_generation_at);
  end if;
  if job.running and job.started_at>moment-interval '90 seconds' then return jsonb_build_object('state','running');end if;
  if not job.running and job.result is null and job.started_at>moment-interval '60 seconds' then return jsonb_build_object('state','backoff');end if;
  if job.attempt_day=(moment at time zone 'UTC')::date and job.attempt_count>=5 then return jsonb_build_object('state','daily-limit');end if;
  if job.lease_id=p_lease then raise exception 'DISCOVERY_LEASE_REUSED';end if;
 end if;
 insert into private.discovery_generations(user_id,lease_id,input_hash,contract_version,started_at,running,attempt_day,attempt_count)
 values(p_user,p_lease,p_hash,p_version,moment,true,(moment at time zone 'UTC')::date,1)
 on conflict(user_id) do update set lease_id=excluded.lease_id,input_hash=excluded.input_hash,contract_version=excluded.contract_version,started_at=moment,running=true,attempt_day=(moment at time zone 'UTC')::date,attempt_count=case when discovery_generations.attempt_day=(moment at time zone 'UTC')::date then discovery_generations.attempt_count+1 else 1 end,result=null,generated_at=null,next_generation_at=null;
 return jsonb_build_object('state','acquired');
end; $$;

