-- M2 catalog: tax slabs, shipping zones, categories, products, variants, media, tags,
-- collections, size charts, banners, pages, and product search maintenance.
-- See docs/DATA_MODEL.md §1 (conventions), §2 (tables) and §3 (RLS).

-- ---------------------------------------------------------------------------
-- tax_slabs
-- ---------------------------------------------------------------------------
create table public.tax_slabs (
  id uuid primary key default gen_random_uuid(),
  hsn_code text not null check (hsn_code ~ '^\d{4,8}$'),
  -- range is min_unit_paise < value <= max_unit_paise ("not exceeding"); null max = no upper bound
  min_unit_paise bigint not null default 0 check (min_unit_paise >= 0),
  max_unit_paise bigint check (max_unit_paise is null or max_unit_paise > min_unit_paise),
  rate_bps integer not null check (rate_bps between 0 and 10000),
  effective_from date not null,
  effective_to date check (effective_to is null or effective_to > effective_from),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint tax_slabs_no_overlap exclude using gist (
    hsn_code with =,
    int8range(min_unit_paise, max_unit_paise, '(]') with &&,
    daterange(effective_from, effective_to, '[)') with &&
  )
);

create trigger tax_slabs_set_updated_at
  before update on public.tax_slabs
  for each row execute function private.set_updated_at();

-- ---------------------------------------------------------------------------
-- shipping_zones
-- ---------------------------------------------------------------------------
create table public.shipping_zones (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  state_codes text[] not null check (cardinality(state_codes) > 0),
  base_paise bigint not null check (base_paise >= 0),
  base_weight_grams integer not null default 500 check (base_weight_grams > 0),
  per_additional_500g_paise bigint not null default 0 check (per_additional_500g_paise >= 0),
  free_above_paise bigint check (free_above_paise >= 0),
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index shipping_zones_state_codes_idx on public.shipping_zones using gin (state_codes);

create trigger shipping_zones_set_updated_at
  before update on public.shipping_zones
  for each row execute function private.set_updated_at();

-- ---------------------------------------------------------------------------
-- categories (nested)
-- ---------------------------------------------------------------------------
create table public.categories (
  id uuid primary key default gen_random_uuid(),
  parent_id uuid references public.categories (id) on delete restrict,
  name text not null,
  slug text not null unique check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  image_key text,
  sort_order integer not null default 0,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (parent_id is distinct from id)
);

create index categories_parent_id_idx on public.categories (parent_id);

create trigger categories_set_updated_at
  before update on public.categories
  for each row execute function private.set_updated_at();

create or replace function private.reject_category_cycle()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.parent_id is not null and exists (
    with recursive ancestors as (
      select c.id, c.parent_id from public.categories c where c.id = new.parent_id
      union
      select c.id, c.parent_id from public.categories c join ancestors a on c.id = a.parent_id
    )
    select 1 from ancestors where id = new.id
  ) then
    raise exception 'category cannot be its own ancestor' using errcode = '23514';
  end if;
  return new;
end;
$$;

create trigger categories_reject_cycle
  before insert or update of parent_id on public.categories
  for each row execute function private.reject_category_cycle();

-- ---------------------------------------------------------------------------
-- size_charts
-- ---------------------------------------------------------------------------
create table public.size_charts (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  data jsonb not null check (jsonb_typeof(data) = 'object'),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger size_charts_set_updated_at
  before update on public.size_charts
  for each row execute function private.set_updated_at();

-- ---------------------------------------------------------------------------
-- tags
-- ---------------------------------------------------------------------------
create table public.tags (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text not null unique check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger tags_set_updated_at
  before update on public.tags
  for each row execute function private.set_updated_at();

-- ---------------------------------------------------------------------------
-- products
-- ---------------------------------------------------------------------------
create table public.products (
  id uuid primary key default gen_random_uuid(),
  category_id uuid not null references public.categories (id) on delete restrict,
  title text not null check (char_length(title) between 1 and 200),
  slug text not null unique check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  description text,
  fabric text,
  style text,
  occasion text,
  care text,
  hsn_code text not null check (hsn_code ~ '^\d{4,8}$'),
  country_of_origin text not null default 'India',
  size_chart_id uuid references public.size_charts (id) on delete restrict,
  status text not null default 'draft' check (status in ('draft', 'active', 'archived')),
  published_at timestamptz,
  seo_title text,
  seo_description text,
  -- Maintained by triggers (title/fabric here, tag names via product_tags/tags).
  search tsvector not null default ''::tsvector,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index products_category_id_idx on public.products (category_id);
create index products_size_chart_id_idx on public.products (size_chart_id);
create index products_status_published_idx on public.products (status, published_at desc);
create index products_search_idx on public.products using gin (search);
create index products_title_trgm_idx on public.products using gin (title extensions.gin_trgm_ops);

create trigger products_set_updated_at
  before update on public.products
  for each row execute function private.set_updated_at();

create or replace function private.set_product_published_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.status = 'active' and new.published_at is null then
    new.published_at := now();
  end if;
  return new;
end;
$$;

create trigger products_set_published_at
  before insert or update of status on public.products
  for each row execute function private.set_product_published_at();

-- ---------------------------------------------------------------------------
-- product_variants
-- ---------------------------------------------------------------------------
create table public.product_variants (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references public.products (id) on delete restrict,
  sku text not null unique check (sku ~ '^[A-Z0-9][A-Z0-9-]{0,39}$'),
  size text not null,
  colour text not null,
  colour_hex text check (colour_hex ~ '^#[0-9A-Fa-f]{6}$'),
  mrp_paise bigint not null check (mrp_paise > 0),
  price_paise bigint not null check (price_paise > 0),
  weight_grams integer not null check (weight_grams > 0),
  stock integer not null default 0,
  reserved integer not null default 0,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (price_paise <= mrp_paise),
  check (stock >= 0 and reserved >= 0 and reserved <= stock),
  unique (product_id, size, colour)
);

create trigger product_variants_set_updated_at
  before update on public.product_variants
  for each row execute function private.set_updated_at();

-- ---------------------------------------------------------------------------
-- product_media
-- ---------------------------------------------------------------------------
create table public.product_media (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references public.products (id) on delete restrict,
  colour text, -- null = shown for every colour
  r2_key text not null,
  alt text,
  sort_order integer not null default 0,
  kind text not null default 'image' check (kind in ('image')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index product_media_product_sort_idx on public.product_media (product_id, sort_order);

create trigger product_media_set_updated_at
  before update on public.product_media
  for each row execute function private.set_updated_at();

-- ---------------------------------------------------------------------------
-- product_tags
-- ---------------------------------------------------------------------------
create table public.product_tags (
  product_id uuid not null references public.products (id) on delete cascade,
  tag_id uuid not null references public.tags (id) on delete restrict,
  created_at timestamptz not null default now(),
  primary key (product_id, tag_id)
);

create index product_tags_tag_id_idx on public.product_tags (tag_id);

-- ---------------------------------------------------------------------------
-- collections
-- ---------------------------------------------------------------------------
create table public.collections (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  slug text not null unique check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  description text,
  kind text not null default 'manual' check (kind in ('manual')),
  image_key text,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger collections_set_updated_at
  before update on public.collections
  for each row execute function private.set_updated_at();

create table public.collection_products (
  collection_id uuid not null references public.collections (id) on delete cascade,
  product_id uuid not null references public.products (id) on delete restrict,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  primary key (collection_id, product_id)
);

create index collection_products_product_id_idx on public.collection_products (product_id);
create index collection_products_sort_idx on public.collection_products (collection_id, sort_order);

-- ---------------------------------------------------------------------------
-- banners, pages
-- ---------------------------------------------------------------------------
create table public.banners (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  image_key text not null,
  link text check (link is null or link ~ '^/'), -- internal paths only
  placement text not null default 'hero' check (placement in ('hero')),
  sort_order integer not null default 0,
  starts_at timestamptz,
  ends_at timestamptz,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (ends_at is null or starts_at is null or ends_at > starts_at)
);

create index banners_placement_sort_idx on public.banners (placement, sort_order);

create trigger banners_set_updated_at
  before update on public.banners
  for each row execute function private.set_updated_at();

create table public.pages (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  title text not null,
  body text not null default '',
  seo_title text,
  seo_description text,
  is_published boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger pages_set_updated_at
  before update on public.pages
  for each row execute function private.set_updated_at();

-- ---------------------------------------------------------------------------
-- Product search (title + fabric + tag names)
-- ---------------------------------------------------------------------------
create or replace function private.build_product_search(p_product_id uuid, p_title text, p_fabric text)
returns tsvector
language sql
stable
security definer
set search_path = ''
as $$
  select
    setweight(to_tsvector('simple'::regconfig, coalesce(p_title, '')), 'A')
    || setweight(to_tsvector('simple'::regconfig, coalesce(p_fabric, '')), 'B')
    || setweight(to_tsvector('simple'::regconfig, coalesce((
         select string_agg(t.name, ' ')
         from public.product_tags pt
         join public.tags t on t.id = pt.tag_id
         where pt.product_id = p_product_id
       ), '')), 'B');
$$;

create or replace function private.products_set_search()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.search := private.build_product_search(new.id, new.title, new.fabric);
  return new;
end;
$$;

create trigger products_set_search
  before insert or update of title, fabric on public.products
  for each row execute function private.products_set_search();

create or replace function private.refresh_product_search(p_product_id uuid)
returns void
language sql
security definer
set search_path = ''
as $$
  update public.products p
  set search = private.build_product_search(p.id, p.title, p.fabric)
  where p.id = p_product_id;
$$;

create or replace function private.product_tags_refresh_search()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_op in ('INSERT', 'UPDATE') then
    perform private.refresh_product_search(new.product_id);
  end if;
  if tg_op in ('DELETE', 'UPDATE') then
    perform private.refresh_product_search(old.product_id);
  end if;
  return null;
end;
$$;

create trigger product_tags_refresh_search
  after insert or update or delete on public.product_tags
  for each row execute function private.product_tags_refresh_search();

create or replace function private.tags_refresh_search()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform private.refresh_product_search(pt.product_id)
  from public.product_tags pt
  where pt.tag_id = new.id;
  return null;
end;
$$;

create trigger tags_refresh_search
  after update of name on public.tags
  for each row execute function private.tags_refresh_search();

revoke all on function private.build_product_search(uuid, text, text) from public;
revoke all on function private.refresh_product_search(uuid) from public;
grant execute on function private.build_product_search(uuid, text, text) to authenticated, service_role;
grant execute on function private.refresh_product_search(uuid) to authenticated, service_role;

-- ---------------------------------------------------------------------------
-- Privileges
-- ---------------------------------------------------------------------------
-- Visitors never write catalog data; admins write through RLS-checked policies below.
revoke insert, update, delete, truncate on
  public.tax_slabs, public.shipping_zones, public.categories, public.size_charts, public.tags,
  public.products, public.product_variants, public.product_media, public.product_tags,
  public.collections, public.collection_products, public.banners, public.pages
from anon;

-- Stock only changes through DB functions (AGENTS.md §5.5). Admins may set the initial stock on
-- insert but never update stock or reserved directly; `search` is trigger-maintained.
revoke insert, update on public.product_variants from authenticated;
grant insert (product_id, sku, size, colour, colour_hex, mrp_paise, price_paise, weight_grams, stock, is_active)
  on public.product_variants to authenticated;
grant update (sku, size, colour, colour_hex, mrp_paise, price_paise, weight_grams, is_active)
  on public.product_variants to authenticated;

revoke insert, update on public.products from authenticated;
grant insert (category_id, title, slug, description, fabric, style, occasion, care, hsn_code,
              country_of_origin, size_chart_id, status, published_at, seo_title, seo_description)
  on public.products to authenticated;
grant update (category_id, title, slug, description, fabric, style, occasion, care, hsn_code,
              country_of_origin, size_chart_id, status, published_at, seo_title, seo_description)
  on public.products to authenticated;

-- ---------------------------------------------------------------------------
-- RLS: public read of live rows, admin write (one policy per command)
-- ---------------------------------------------------------------------------
alter table public.tax_slabs enable row level security;
alter table public.shipping_zones enable row level security;
alter table public.categories enable row level security;
alter table public.size_charts enable row level security;
alter table public.tags enable row level security;
alter table public.products enable row level security;
alter table public.product_variants enable row level security;
alter table public.product_media enable row level security;
alter table public.product_tags enable row level security;
alter table public.collections enable row level security;
alter table public.collection_products enable row level security;
alter table public.banners enable row level security;
alter table public.pages enable row level security;

-- Reads
create policy "tax_slabs: read" on public.tax_slabs for select to anon, authenticated
  using (true);
create policy "shipping_zones: read active" on public.shipping_zones for select to anon, authenticated
  using (is_active or (select private.is_admin()));
create policy "categories: read active" on public.categories for select to anon, authenticated
  using (is_active or (select private.is_admin()));
create policy "size_charts: read" on public.size_charts for select to anon, authenticated
  using (true);
create policy "tags: read" on public.tags for select to anon, authenticated
  using (true);
create policy "products: read active" on public.products for select to anon, authenticated
  using (status = 'active' or (select private.is_admin()));
create policy "product_variants: read active" on public.product_variants for select to anon, authenticated
  using (
    (is_active and exists (
      select 1 from public.products p where p.id = product_id and p.status = 'active'
    ))
    or (select private.is_admin())
  );
create policy "product_media: read active" on public.product_media for select to anon, authenticated
  using (
    exists (select 1 from public.products p where p.id = product_id and p.status = 'active')
    or (select private.is_admin())
  );
create policy "product_tags: read active" on public.product_tags for select to anon, authenticated
  using (
    exists (select 1 from public.products p where p.id = product_id and p.status = 'active')
    or (select private.is_admin())
  );
create policy "collections: read active" on public.collections for select to anon, authenticated
  using (is_active or (select private.is_admin()));
create policy "collection_products: read active" on public.collection_products for select to anon, authenticated
  using (
    (
      exists (select 1 from public.collections c where c.id = collection_id and c.is_active)
      and exists (select 1 from public.products p where p.id = product_id and p.status = 'active')
    )
    or (select private.is_admin())
  );
create policy "banners: read live" on public.banners for select to anon, authenticated
  using (
    (is_active and (starts_at is null or starts_at <= now()) and (ends_at is null or ends_at > now()))
    or (select private.is_admin())
  );
create policy "pages: read published" on public.pages for select to anon, authenticated
  using (is_published or (select private.is_admin()));

-- Admin writes. TODO(owner): should tax_slabs and shipping_zones be owner-only?
do $$
declare
  t text;
begin
  foreach t in array array[
    'tax_slabs', 'shipping_zones', 'categories', 'size_charts', 'tags', 'products',
    'product_variants', 'product_media', 'product_tags', 'collections', 'collection_products',
    'banners', 'pages'
  ] loop
    execute format(
      'create policy "%1$s: admin insert" on public.%1$I for insert to authenticated
         with check ((select private.is_admin()))', t);
    execute format(
      'create policy "%1$s: admin update" on public.%1$I for update to authenticated
         using ((select private.is_admin())) with check ((select private.is_admin()))', t);
    execute format(
      'create policy "%1$s: admin delete" on public.%1$I for delete to authenticated
         using ((select private.is_admin()))', t);
  end loop;
end;
$$;
