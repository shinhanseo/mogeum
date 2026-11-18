-- Source inventory stays separate from verified tasting facts and personal records.
create table private.product_inventory (
  id text primary key,
  source text not null,
  source_id text not null,
  name text not null check(length(name) between 1 and 1000),
  normalized_name text not null,
  category text not null check(category in ('whisky','wine','beer','traditional','other')),
  source_url text not null check(source_url ~ '^https://'),
  document jsonb not null check(jsonb_typeof(document)='object' and octet_length(document::text)<=131072),
  collected_at timestamptz not null,
  review_state text not null default 'not_reviewed' check(review_state in ('not_reviewed','reviewed','held')),
  unique(source,source_id)
);
create index product_inventory_name on private.product_inventory(normalized_name);
create index product_inventory_category on private.product_inventory(category,source);
create table private.product_inventory_images (
  product_id text primary key references private.product_inventory(id) on delete cascade,
  source_url text not null check(source_url ~ '^https://'),
  sha256 text check(sha256 is null or sha256 ~ '^[a-f0-9]{64}$'),
  original_path text,
  preview_path text,
  width integer check(width>0),
  height integer check(height>0),
  download_state text not null check(download_state in ('pending','downloaded','failed')),
  rights_status text not null default 'permission_unconfirmed'
    check(rights_status in ('permission_unconfirmed','licensed','producer_permission','public_domain')),
  error text,
  updated_at timestamptz not null
);
alter table private.product_inventory enable row level security;
alter table private.product_inventory_images enable row level security;
revoke all on private.product_inventory,private.product_inventory_images from public,anon,authenticated;
grant usage on schema private to service_role;
grant all on private.product_inventory,private.product_inventory_images to service_role;
