-- Shared public-product research only. No user notes, identifiers or preferences.
create table private.product_research_jobs (
 query_hash text primary key check(query_hash ~ '^[0-9a-f]{64}$'),
 lease_id uuid not null,
 status text not null check(status in ('running','candidate','failed')),
 started_at timestamptz not null default now(),
 completed_at timestamptz,
 result jsonb check(result is null or (jsonb_typeof(result)='object' and result->>'status'='candidate' and octet_length(result::text)<=100000)),
 check((status='candidate')=(result is not null))
);
create table private.product_research_attempts (
 lease_id uuid primary key,
 query_hash text not null,
 started_at timestamptz not null default now()
);
create index on private.product_research_attempts(started_at);
alter table private.product_research_jobs enable row level security;
alter table private.product_research_attempts enable row level security;
revoke all on private.product_research_jobs,private.product_research_attempts from public,anon,authenticated;

create function public.begin_product_research(p_hash text,p_lease uuid) returns jsonb
language plpgsql security definer set search_path='' as $$
declare job private.product_research_jobs; moment timestamptz:=now();
begin
 if p_hash is null or p_hash !~ '^[0-9a-f]{64}$' or p_lease is null then raise exception 'INVALID_RESEARCH_JOB';end if;
 -- One lock serializes shared cache acquisition AND global attempt reservations.
 perform pg_advisory_xact_lock(hashtextextended('mogeum:product-research:budget',0));
 select * into job from private.product_research_jobs where query_hash=p_hash;
 if found then
  if job.status='candidate' and job.completed_at>moment-interval '7 days' then return jsonb_build_object('state','cached','result',job.result);end if;
  if job.status='running' and job.started_at>moment-interval '60 seconds' then return jsonb_build_object('state','running');end if;
  if job.started_at>moment-interval '5 minutes' then return jsonb_build_object('state','backoff');end if;
 end if;
 if exists(select 1 from private.product_research_attempts where lease_id=p_lease) then raise exception 'RESEARCH_LEASE_REUSED';end if;
 if (select count(*) from private.product_research_jobs where status='running' and started_at>moment-interval '60 seconds')>=2 then return jsonb_build_object('state','busy');end if;
 if (select count(*) from private.product_research_attempts where started_at>=date_trunc('day',moment at time zone 'UTC') at time zone 'UTC')>=20 then return jsonb_build_object('state','daily-limit');end if;
 if (select count(*) from private.product_research_attempts where started_at>=date_trunc('month',moment at time zone 'UTC') at time zone 'UTC')>=200 then return jsonb_build_object('state','monthly-limit');end if;
 insert into private.product_research_attempts(lease_id,query_hash) values(p_lease,p_hash);
 insert into private.product_research_jobs(query_hash,lease_id,status) values(p_hash,p_lease,'running')
 on conflict(query_hash) do update set lease_id=excluded.lease_id,status='running',started_at=moment,completed_at=null,result=null;
 return jsonb_build_object('state','acquired');
end; $$;
create function public.finish_product_research(p_hash text,p_lease uuid,p_result jsonb) returns boolean
language plpgsql security definer set search_path='' as $$
begin
 if p_result is not null and (jsonb_typeof(p_result)<>'object' or p_result->>'status' is distinct from 'candidate' or octet_length(p_result::text)>100000) then raise exception 'INVALID_RESEARCH_RESULT';end if;
 update private.product_research_jobs set status=case when p_result is null then 'failed' else 'candidate' end,result=p_result,completed_at=now()
 where query_hash=p_hash and lease_id=p_lease and status='running' and started_at>now()-interval '60 seconds';
 return found;
end; $$;
revoke all on function public.begin_product_research(text,uuid),public.finish_product_research(text,uuid,jsonb) from public,anon,authenticated;
grant execute on function public.begin_product_research(text,uuid),public.finish_product_research(text,uuid,jsonb) to service_role;
