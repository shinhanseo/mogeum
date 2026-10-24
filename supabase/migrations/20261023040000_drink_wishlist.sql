-- Curated product IDs only; bookmark state is never a tasting record or sensory evidence.
create table public.drink_wishlist (
 user_id uuid not null references auth.users(id) on delete cascade,
 product_id text not null check(product_id in ('glenlivet-12', 'makers-mark', 'glenfiddich-12', 'laphroaig-10', 'ardbeg-10', 'johnnie-walker-black-12', 'jameson-original', 'balvenie-doublewood-12', 'guinness-draught', 'weihenstephaner-hefeweissbier', 'paulaner-weissbier', 'hoegaarden-white', 'pilsner-urquell', 'heineken-original', 'sierra-nevada-pale-ale', 'brewdog-punk-ipa-54', 'cloudy-bay-sb-2022', 'cloudy-bay-sb-2024', 'cloudy-bay-chardonnay-2023', 'cloudy-bay-pinot-noir-2022', 'cloudy-bay-te-koko-2021', 'cloudy-bay-pelorus-rose-nv', 'moet-imperial-brut-nv', 'veuve-clicquot-yellow-label-nv', 'naroo-6', 'naroo-115', 'gleem-yakju', 'hwayo-25', 'hwayo-41', 'hwayo-53', 'hwayo-xp', 'boksoondoga-son')),
 saved boolean not null,
 revision integer not null check(revision>0),
 updated_at timestamptz not null default now(),
 primary key(user_id,product_id)
);
alter table public.drink_wishlist enable row level security;
create policy wishlist_read on public.drink_wishlist for select to authenticated using(user_id=auth.uid() and private.active_user());
revoke all on public.drink_wishlist from anon,authenticated;
grant select on public.drink_wishlist to authenticated;
create table private.wishlist_operations (
 user_id uuid not null references auth.users(id) on delete cascade,
 operation_id uuid not null,
 request jsonb not null,
 result jsonb not null,
 primary key(user_id,operation_id)
);
create function public.set_drink_wishlist(p_operation_id uuid,p_product_id text,p_saved boolean,p_expected_revision integer)
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
 insert into public.drink_wishlist(user_id,product_id,saved,revision) values(owner_id,p_product_id,p_saved,coalesce(current_revision,0)+1)
 on conflict(user_id,product_id) do update set saved=excluded.saved,revision=excluded.revision,updated_at=now();
 result=jsonb_build_object('productId',p_product_id,'saved',p_saved,'revision',coalesce(current_revision,0)+1,'replayed',false);
 insert into private.wishlist_operations(user_id,operation_id,request,result) values(owner_id,p_operation_id,payload,result);
 return result;
end $$;
revoke all on function public.set_drink_wishlist(uuid,text,boolean,integer) from public,anon;
grant execute on function public.set_drink_wishlist(uuid,text,boolean,integer) to authenticated;
create index records_owner_id on public.tasting_records(user_id,id);
