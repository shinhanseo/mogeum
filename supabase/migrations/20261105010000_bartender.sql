-- Private, bounded chat. The app never controls owner, quotas, model or stored state.
create table private.bartender_sessions (
 user_id uuid primary key references auth.users(id) on delete cascade,
 revision integer not null default 0, document jsonb not null default '{"conditions":{"category":null,"desired":[],"avoid":[],"budget":null,"food":null},"messages":[],"research":null}',
 updated_at timestamptz not null default now()
);
create table private.bartender_turns (
 user_id uuid not null references auth.users(id) on delete cascade, operation_id uuid not null,
 input_hash text not null, expected_revision integer not null, started_at timestamptz not null,
 status text not null check(status in ('running','complete','failed')), result jsonb,
 input_tokens integer, output_tokens integer, primary key(user_id,operation_id)
);
create table private.bartender_daily (
 day date not null, bucket text not null, attempts integer not null, reserved_microusd bigint not null,
 primary key(day,bucket)
);
alter table private.bartender_sessions enable row level security;
alter table private.bartender_turns enable row level security;
alter table private.bartender_daily enable row level security;
revoke all on private.bartender_sessions,private.bartender_turns,private.bartender_daily from public,anon,authenticated;
create function public.bartender_context() returns jsonb language sql security definer set search_path='' as $$
 select case when auth.uid() is null then null else coalesce((select jsonb_build_object('revision',revision,'document',document) from private.bartender_sessions where user_id=auth.uid()),'{"revision":0,"document":{"conditions":{"category":null,"desired":[],"avoid":[],"budget":null,"food":null},"messages":[],"research":null}}'::jsonb) end;
$$;
revoke all on function public.bartender_context() from public,anon;
grant execute on function public.bartender_context() to authenticated;
create function public.begin_bartender_turn(p_owner uuid,p_operation uuid,p_hash text,p_revision integer) returns jsonb
language plpgsql security definer set search_path='' as $$
declare previous private.bartender_turns; session private.bartender_sessions; today date:=(clock_timestamp() at time zone 'UTC')::date; used integer;
begin
 if p_owner is null or p_operation is null or p_revision is null or p_revision<0 or p_hash is null or p_hash!~'^[a-f0-9]{64}$' or not exists(select 1 from auth.users where id=p_owner) then raise exception 'INVALID_BARTENDER_REQUEST';end if;
 perform pg_advisory_xact_lock(hashtextextended('bartender:global-budget',0));
 select * into previous from private.bartender_turns where user_id=p_owner and operation_id=p_operation;
 if found then
  if previous.input_hash<>p_hash or previous.expected_revision<>p_revision then return jsonb_build_object('state','conflict');end if;
  if previous.status='complete' then return jsonb_build_object('state','cached','result',previous.result);end if;
  return jsonb_build_object('state',case when previous.status='running' and previous.started_at>clock_timestamp()-interval '120 seconds' then 'running' else 'failed' end);
 end if;
 insert into private.bartender_sessions(user_id) values(p_owner) on conflict do nothing;
 select * into session from private.bartender_sessions where user_id=p_owner for update;
 if session.revision<>p_revision then return jsonb_build_object('state','stale');end if;
 if exists(select 1 from private.bartender_turns where user_id=p_owner and status='running' and started_at>clock_timestamp()-interval '120 seconds') then return jsonb_build_object('state','running');end if;
 select attempts into used from private.bartender_daily where day=today and bucket=p_owner::text;
 if coalesce(used,0)>=30 then return jsonb_build_object('state','daily-limit');end if;
 select attempts into used from private.bartender_daily where day=today and bucket='global';
 if coalesce(used,0)>=1000 then return jsonb_build_object('state','global-limit');end if;
 -- Reserve $0.01 for each text attempt, including failures. Search has its own shared budget.
 insert into private.bartender_daily values(today,'global',1,10000),(today,p_owner::text,1,10000)
 on conflict(day,bucket) do update set attempts=private.bartender_daily.attempts+1,reserved_microusd=private.bartender_daily.reserved_microusd+10000;
 insert into private.bartender_turns(user_id,operation_id,input_hash,expected_revision,started_at,status) values(p_owner,p_operation,p_hash,p_revision,clock_timestamp(),'running');
 return jsonb_build_object('state','acquired','document',session.document);
end;$$;
create function public.finish_bartender_turn(p_owner uuid,p_operation uuid,p_hash text,p_document jsonb,p_result jsonb,p_input_tokens integer default 0,p_output_tokens integer default 0) returns boolean
language plpgsql security definer set search_path='' as $$
declare job private.bartender_turns;
begin
 perform pg_advisory_xact_lock(hashtextextended('bartender:global-budget',0));
 select * into job from private.bartender_turns where user_id=p_owner and operation_id=p_operation for update;
 if not found or job.input_hash is distinct from p_hash or job.status<>'running' or job.started_at<=clock_timestamp()-interval '120 seconds' then return false;end if;
 if p_result is null then update private.bartender_turns set status='failed' where user_id=p_owner and operation_id=p_operation;return true;end if;
 if p_document is null or jsonb_typeof(p_document)<>'object' or jsonb_typeof(p_document->'messages') is distinct from 'array' or jsonb_array_length(p_document->'messages')>12 or octet_length(p_document::text)>40000 or octet_length(p_result::text)>40000 or p_input_tokens<0 or p_output_tokens<0 then raise exception 'INVALID_BARTENDER_RESULT';end if;
 update private.bartender_sessions set revision=revision+1,document=p_document,updated_at=clock_timestamp() where user_id=p_owner and revision=job.expected_revision;
 if not found then return false;end if;
 update private.bartender_turns set status='complete',result=p_result,input_tokens=p_input_tokens,output_tokens=p_output_tokens where user_id=p_owner and operation_id=p_operation;
 return true;
end;$$;
revoke all on function public.begin_bartender_turn(uuid,uuid,text,integer), public.finish_bartender_turn(uuid,uuid,text,jsonb,jsonb,integer,integer) from public,anon,authenticated;
grant execute on function public.begin_bartender_turn(uuid,uuid,text,integer), public.finish_bartender_turn(uuid,uuid,text,jsonb,jsonb,integer,integer) to service_role;
create function public.clear_bartender_conversation() returns boolean language plpgsql security definer set search_path='' as $$
declare owner uuid:=auth.uid();
begin
 if owner is null then raise exception 'UNAUTHENTICATED';end if;
 perform pg_advisory_xact_lock(hashtextextended('bartender:global-budget',0));
 if exists(select 1 from private.bartender_turns where user_id=owner and status='running' and started_at>clock_timestamp()-interval '120 seconds') then return false;end if;
 insert into private.bartender_sessions(user_id) values(owner) on conflict do nothing;
 update private.bartender_sessions set revision=revision+1,document='{"conditions":{"category":null,"desired":[],"avoid":[],"budget":null,"food":null},"messages":[],"research":null}'::jsonb,updated_at=clock_timestamp() where user_id=owner;
 delete from private.bartender_turns where user_id=owner;
 -- Daily counters survive clearing a conversation.
 return true;
end;$$;
revoke all on function public.clear_bartender_conversation() from public,anon;
grant execute on function public.clear_bartender_conversation() to authenticated;
