-- Edition-scoped catalog built from attributed public product observations.
create table public.catalog_products (
 id text primary key check(id ~ '^inventory-[a-f0-9]{32}$'),
 family_id text not null,
 category public.drink_category not null,
 normalized_name text not null,
 identity jsonb not null,
 document jsonb not null,
 state text not null check(state in ('ready','identity-only','held')),
 primary_inventory_id text not null references private.product_inventory(id),
 mapping_version text not null,
 revision integer not null default 1,
 updated_at timestamptz not null default now(),
 check(category in ('whisky','wine','beer','traditional')),
 check(document->>'id'=id and document->>'familyId'=family_id and document->>'category'=category::text),
 check(jsonb_typeof(document->'features')='array'),
 check(state<>'ready' or jsonb_array_length(document->'features')>0),
 check(octet_length(document::text)<=131072)
);
create index catalog_products_family on public.catalog_products(family_id);
create index catalog_products_category on public.catalog_products(category,state);
create table private.catalog_inventory_links (
 inventory_id text primary key references private.product_inventory(id),
 product_id text not null references public.catalog_products(id)
);
create table public.catalog_product_aliases (
 alias text not null,product_id text not null references public.catalog_products(id) on delete cascade,
 primary key(alias,product_id)
);
create table public.catalog_product_features (
 feature_id text not null,product_id text not null references public.catalog_products(id) on delete cascade,
 primary key(feature_id,product_id)
);
create table private.catalog_product_ids(id text primary key);
insert into private.catalog_product_ids select id from public.product_catalog;
create function private.register_catalog_product_id() returns trigger language plpgsql security definer set search_path='' as $$
begin insert into private.catalog_product_ids values(new.id) on conflict do nothing;return new;end $$;
create trigger register_existing_catalog_id after insert on public.product_catalog for each row execute function private.register_catalog_product_id();
create trigger register_inventory_catalog_id after insert on public.catalog_products for each row execute function private.register_catalog_product_id();
alter table public.drink_wishlist drop constraint drink_wishlist_product_id_fkey;
alter table public.drink_wishlist add constraint drink_wishlist_product_id_fkey foreign key(product_id) references private.catalog_product_ids(id) on delete restrict;

alter table public.catalog_products enable row level security;
alter table public.catalog_product_aliases enable row level security;
alter table public.catalog_product_features enable row level security;
alter table private.catalog_inventory_links enable row level security;
alter table private.catalog_product_ids enable row level security;
create policy catalog_products_read on public.catalog_products for select to authenticated using(state<>'held' and private.active_user());
create policy catalog_aliases_read on public.catalog_product_aliases for select to authenticated using(private.active_user() and exists(select 1 from public.catalog_products p where p.id=product_id));
create policy catalog_features_read on public.catalog_product_features for select to authenticated using(private.active_user() and exists(select 1 from public.catalog_products p where p.id=product_id));
revoke all on public.catalog_products,public.catalog_product_aliases,public.catalog_product_features,private.catalog_inventory_links,private.catalog_product_ids from public,anon,authenticated;
grant select on public.catalog_products,public.catalog_product_aliases,public.catalog_product_features to authenticated;
grant all on public.catalog_products,public.catalog_product_aliases,public.catalog_product_features,private.catalog_inventory_links,private.catalog_product_ids to service_role;

create function public.catalog_product_documents(p_ids text[]) returns jsonb language plpgsql stable security invoker set search_path='' as $$
begin
 if auth.uid() is null or not private.active_user() then raise exception 'UNAUTHENTICATED';end if;
 if p_ids is null or cardinality(p_ids)>200 then raise exception 'INVALID_CATALOG_QUERY';end if;
 return coalesce((select jsonb_agg(document order by id) from (
  select id,document from public.catalog_products where id=any(p_ids)
  union all select id,document from public.product_catalog where status='verified' and id=any(p_ids)
 ) p),'[]'::jsonb);
end $$;
create function public.catalog_search(p_aliases text[]) returns jsonb language plpgsql stable security invoker set search_path='' as $$
begin
 if auth.uid() is null or not private.active_user() then raise exception 'UNAUTHENTICATED';end if;
 if p_aliases is null or cardinality(p_aliases)>500 then raise exception 'INVALID_CATALOG_QUERY';end if;
 return coalesce((select jsonb_agg(document order by id) from (
  select distinct p.id,p.document from public.catalog_product_aliases a join public.catalog_products p on p.id=a.product_id
  where a.alias=any(p_aliases) order by p.id limit 950
 ) p),'[]'::jsonb);
end $$;
create function public.catalog_recommendation_candidates(p_features text[]) returns jsonb language plpgsql stable security invoker set search_path='' as $$
begin
 if auth.uid() is null or not private.active_user() then raise exception 'UNAUTHENTICATED';end if;
 if p_features is null or cardinality(p_features)>1000 then raise exception 'INVALID_CATALOG_QUERY';end if;
 return coalesce((select jsonb_agg(document order by category,n,id) from (
  select id,document,category,row_number() over(partition by category order by matches desc,id) n from (
   select p.id,p.document,p.category,count(*) matches from public.catalog_product_features f
   join public.catalog_products p on p.id=f.product_id
   where f.feature_id=any(p_features) and p.state='ready' and not exists(
    select 1 from public.drink_wishlist w join public.catalog_products saved on saved.id=w.product_id
    where w.user_id=auth.uid() and w.saved and saved.family_id=p.family_id
   ) group by p.id
  ) scored
 ) ranked where n<=100),'[]'::jsonb);
end $$;
revoke all on function public.catalog_product_documents(text[]),public.catalog_search(text[]),public.catalog_recommendation_candidates(text[]) from public,anon;
grant execute on function public.catalog_product_documents(text[]),public.catalog_search(text[]),public.catalog_recommendation_candidates(text[]) to authenticated,service_role;

create or replace function public.set_drink_wishlist(p_operation_id uuid,p_product_id text,p_saved boolean,p_expected_revision integer)
returns jsonb language plpgsql security definer set search_path='' as $$
declare owner_id uuid:=auth.uid(); current_revision integer; payload jsonb; old_request jsonb; old_result jsonb; result jsonb;
begin
 if owner_id is null or not private.active_user() then raise exception 'UNAUTHENTICATED';end if;
 if p_operation_id is null or p_product_id is null or length(p_product_id)>160 or p_saved is null or p_expected_revision is null or p_expected_revision<0 then raise exception 'INVALID_WISHLIST';end if;
 payload=jsonb_build_object('productId',p_product_id,'saved',p_saved,'expectedRevision',p_expected_revision);
 perform pg_advisory_xact_lock(hashtextextended(owner_id::text||p_operation_id::text,0));
 select o.request,o.result into old_request,old_result from private.wishlist_operations o where o.user_id=owner_id and o.operation_id=p_operation_id;
 if found then
  if old_request<>payload then raise exception 'OPERATION_PAYLOAD_CHANGED';end if;
  return old_result||jsonb_build_object('replayed',true);
 end if;
 perform pg_advisory_xact_lock(hashtextextended(owner_id::text||p_product_id,1));
 select w.revision into current_revision from public.drink_wishlist w where w.user_id=owner_id and w.product_id=p_product_id;
 if coalesce(current_revision,0)<>p_expected_revision then raise exception 'STALE_WISHLIST';end if;
 -- Candidate/held products cannot create new saved entries. Existing saves can always be removed.
 if not exists(select 1 from public.product_catalog p where p.id=p_product_id and p.status='verified')
    and not exists(select 1 from public.catalog_products p where p.id=p_product_id and p.state<>'held')
    and not (not p_saved and current_revision is not null) then
  raise exception using errcode='23514',message='PRODUCT_NOT_VERIFIED';
 end if;
 insert into public.drink_wishlist(user_id,product_id,saved,revision) values(owner_id,p_product_id,p_saved,coalesce(current_revision,0)+1)
 on conflict(user_id,product_id) do update set saved=excluded.saved,revision=excluded.revision,updated_at=now();
 result=jsonb_build_object('productId',p_product_id,'saved',p_saved,'revision',coalesce(current_revision,0)+1,'replayed',false);
 insert into private.wishlist_operations(user_id,operation_id,request,result) values(owner_id,p_operation_id,payload,result);
 return result;
end $$;
revoke all on function public.set_drink_wishlist(uuid,text,boolean,integer) from public,anon;
grant execute on function public.set_drink_wishlist(uuid,text,boolean,integer) to authenticated;

