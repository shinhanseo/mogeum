-- Personal generation state is server-only; successful batches live seven days.
create table private.discovery_generations (
 user_id uuid primary key references auth.users(id) on delete cascade,
 lease_id uuid not null,
 input_hash text not null check(input_hash ~ '^[0-9a-f]{64}$'),
 contract_version text not null check(length(contract_version) between 1 and 100),
 started_at timestamptz not null default now(),
 running boolean not null default true,
 generated_at timestamptz,
 next_generation_at timestamptz,
 result jsonb,
 check((result is null)=(generated_at is null)),
 check((generated_at is null)=(next_generation_at is null)),
 check(result is null or (jsonb_typeof(result)='object' and octet_length(result::text)<=128000))
);
alter table private.discovery_generations enable row level security;
revoke all on private.discovery_generations from public,anon,authenticated;

create function public.begin_discovery_generation(p_user uuid,p_hash text,p_version text,p_lease uuid) returns jsonb
language plpgsql security definer set search_path='' as $$
declare job private.discovery_generations; moment timestamptz:=clock_timestamp();
begin
 if p_user is null or p_hash is null or p_hash !~ '^[0-9a-f]{64}$' or p_version is null or length(p_version) not between 1 and 100 or p_lease is null then raise exception 'INVALID_DISCOVERY_JOB';end if;
 -- User-level lock prevents per-category/device/key bypass; category is deliberately absent.
 perform pg_advisory_xact_lock(hashtextextended('mogeum:discovery:'||p_user::text,0));
 select * into job from private.discovery_generations where user_id=p_user for update;
 if found then
  if job.next_generation_at>moment then
   if job.input_hash=p_hash and job.contract_version=p_version then
    return jsonb_build_object('state','cached','result',job.result,'generatedAt',job.generated_at,'nextGenerationAt',job.next_generation_at);
   end if;
   -- Do not expose stale personal evidence or silently spend another weekly success slot.
   return jsonb_build_object('state','invalidated','nextGenerationAt',job.next_generation_at);
  end if;
  if job.running and job.started_at>moment-interval '90 seconds' then return jsonb_build_object('state','running');end if;
  if not job.running and job.result is null and job.started_at>moment-interval '60 seconds' then return jsonb_build_object('state','backoff');end if;
  if job.lease_id=p_lease then raise exception 'DISCOVERY_LEASE_REUSED';end if;
 end if;
 insert into private.discovery_generations(user_id,lease_id,input_hash,contract_version,started_at,running)
 values(p_user,p_lease,p_hash,p_version,moment,true)
 on conflict(user_id) do update set lease_id=excluded.lease_id,input_hash=excluded.input_hash,contract_version=excluded.contract_version,started_at=moment,running=true,result=null,generated_at=null,next_generation_at=null;
 return jsonb_build_object('state','acquired');
end; $$;

create function public.finish_discovery_generation(p_user uuid,p_hash text,p_version text,p_lease uuid,p_result jsonb) returns boolean
language plpgsql security definer set search_path='' as $$
declare job private.discovery_generations; moment timestamptz:=clock_timestamp();
begin
 if p_result is not null and (jsonb_typeof(p_result)<>'object' or octet_length(p_result::text)>128000) then raise exception 'INVALID_DISCOVERY_RESULT';end if;
 select * into job from private.discovery_generations where user_id=p_user for update;
 if not found or job.lease_id is distinct from p_lease or job.input_hash is distinct from p_hash or job.contract_version is distinct from p_version then return false;end if;
 -- An identical completion can be retried after a lost response, without moving the deadline.
 if not job.running then return p_result is not null and job.result=p_result;end if;
 if job.started_at<=moment-interval '90 seconds' then return false;end if;
 update private.discovery_generations set running=false,started_at=moment,result=p_result,
 generated_at=case when p_result is null then null else moment end,
 next_generation_at=case when p_result is null then null else moment+interval '168 hours' end
 where user_id=p_user;
 return true;
end; $$;
revoke all on function public.begin_discovery_generation(uuid,text,text,uuid),public.finish_discovery_generation(uuid,text,text,uuid,jsonb) from public,anon,authenticated;
grant execute on function public.begin_discovery_generation(uuid,text,text,uuid),public.finish_discovery_generation(uuid,text,text,uuid,jsonb) to service_role;
