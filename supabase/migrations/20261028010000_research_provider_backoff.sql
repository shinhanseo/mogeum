create table private.product_research_control (
 id boolean primary key default true check(id),
 provider_backoff_until timestamptz not null default '-infinity'
);
alter table private.product_research_control enable row level security;
revoke all on private.product_research_control from public,anon,authenticated;
insert into private.product_research_control(id) values(true);
-- Keep the tested acquisition/quotas behind a service-only wrapper.
alter function public.begin_product_research(text,uuid) set schema private;
revoke all on function private.begin_product_research(text,uuid) from public,anon,authenticated,service_role;
create function public.begin_product_research(p_hash text,p_lease uuid) returns jsonb
language plpgsql security definer set search_path='' as $$
declare moment timestamptz:=now(); cached jsonb; until_time timestamptz;
begin
 if p_hash is null or p_hash !~ '^[0-9a-f]{64}$' or p_lease is null then raise exception 'INVALID_RESEARCH_JOB';end if;
 perform pg_advisory_xact_lock(hashtextextended('mogeum:product-research:budget',0));
 select result into cached from private.product_research_jobs where query_hash=p_hash and status='candidate' and completed_at>moment-interval '7 days';
 if found then return jsonb_build_object('state','cached','result',cached);end if;
 select provider_backoff_until into until_time from private.product_research_control where id;
 if until_time>moment then return jsonb_build_object('state','provider-backoff');end if;
 return private.begin_product_research(p_hash,p_lease);
end; $$;
create function public.pause_product_research_provider(p_seconds integer) returns boolean
language plpgsql security definer set search_path='' as $$
begin
 if p_seconds is null or p_seconds<60 or p_seconds>3600 then raise exception 'INVALID_PROVIDER_BACKOFF';end if;
 perform pg_advisory_xact_lock(hashtextextended('mogeum:product-research:budget',0));
 update private.product_research_control set provider_backoff_until=greatest(provider_backoff_until,now()+make_interval(secs=>p_seconds)) where id;
 return found;
end; $$;
revoke all on function public.begin_product_research(text,uuid),public.pause_product_research_provider(integer) from public,anon,authenticated;
grant execute on function public.begin_product_research(text,uuid),public.pause_product_research_provider(integer) to service_role;
