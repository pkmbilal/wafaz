-- M3 storefront: listing + facet functions for collection, category and search pages,
-- and a guard so a slug can't be both a collection and a category (they share /collections/[slug]).

-- ---------------------------------------------------------------------------
-- Scope: which active products belong to a collection / category tree / search query.
-- security invoker, so RLS on the underlying tables still applies to the caller.
-- ---------------------------------------------------------------------------
create or replace function private.catalog_scope(
  p_collection_slug text,
  p_category_slug text,
  p_query text
)
returns table (product_id uuid, collection_sort integer, rank real)
language sql
stable
set search_path = ''
as $$
  with recursive category_tree as (
    select c.id
    from public.categories c
    where p_category_slug is not null and c.slug = p_category_slug and c.is_active
    union
    select c.id
    from public.categories c
    join category_tree t on c.parent_id = t.id
    where c.is_active
  ),
  collection_members as (
    select cp.product_id, cp.sort_order
    from public.collection_products cp
    join public.collections co on co.id = cp.collection_id
    where p_collection_slug is not null and co.slug = p_collection_slug and co.is_active
  ),
  q as (
    select
      nullif(lower(trim(p_query)), '') as raw,
      case when nullif(trim(p_query), '') is null then null
           else websearch_to_tsquery('simple'::regconfig, p_query) end as tsq
  )
  select
    p.id,
    cm.sort_order,
    case when q.raw is null then 0::real
         else ts_rank(p.search, q.tsq) + extensions.word_similarity(q.raw, lower(p.title)) end
  from public.products p
  cross join q
  left join collection_members cm on cm.product_id = p.id
  where p.status = 'active'
    and (p_collection_slug is null or cm.product_id is not null)
    and (p_category_slug is null or p.category_id in (select id from category_tree))
    and (
      q.raw is null
      or p.search @@ q.tsq
      or extensions.word_similarity(q.raw, lower(p.title)) > 0.4
    );
$$;

-- ---------------------------------------------------------------------------
-- Listing: one row per product with the cheapest matching variant's price.
-- ---------------------------------------------------------------------------
create or replace function public.catalog_products(
  p_collection_slug text default null,
  p_category_slug text default null,
  p_query text default null,
  p_sizes text[] default null,
  p_colours text[] default null,
  p_fabrics text[] default null,
  p_min_paise bigint default null,
  p_max_paise bigint default null,
  p_sort text default 'featured',
  p_limit integer default 24,
  p_offset integer default 0
)
returns table (
  id uuid,
  slug text,
  title text,
  fabric text,
  price_paise bigint,
  mrp_paise bigint,
  in_stock boolean,
  published_at timestamptz,
  image_key text,
  image_alt text,
  colours jsonb,
  total_count bigint
)
language sql
stable
set search_path = ''
as $$
  with scope as (
    select * from private.catalog_scope(p_collection_slug, p_category_slug, p_query)
  ),
  matching_variants as (
    select v.product_id, v.price_paise, v.mrp_paise
    from public.product_variants v
    join scope s on s.product_id = v.product_id
    where v.is_active
      and (coalesce(cardinality(p_sizes), 0) = 0 or v.size = any (p_sizes))
      and (coalesce(cardinality(p_colours), 0) = 0 or v.colour = any (p_colours))
      and (p_min_paise is null or v.price_paise >= p_min_paise)
      and (p_max_paise is null or v.price_paise <= p_max_paise)
  ),
  listed as (
    select
      p.id, p.slug, p.title, p.fabric, p.published_at, s.collection_sort, s.rank,
      cheapest.price_paise, cheapest.mrp_paise
    from scope s
    join public.products p on p.id = s.product_id
    cross join lateral (
      select mv.price_paise, mv.mrp_paise
      from matching_variants mv
      where mv.product_id = s.product_id
      order by mv.price_paise, mv.mrp_paise desc
      limit 1
    ) cheapest
    where coalesce(cardinality(p_fabrics), 0) = 0 or p.fabric = any (p_fabrics)
  )
  select
    l.id,
    l.slug,
    l.title,
    l.fabric,
    l.price_paise,
    l.mrp_paise,
    exists (
      select 1 from public.product_variants v
      where v.product_id = l.id and v.is_active and v.stock - v.reserved > 0
    ),
    l.published_at,
    img.r2_key,
    img.alt,
    coalesce((
      select jsonb_agg(jsonb_build_object('name', c.colour, 'hex', c.colour_hex) order by c.first_seen)
      from (
        select v.colour, min(v.colour_hex) as colour_hex, min(v.created_at) as first_seen
        from public.product_variants v
        where v.product_id = l.id and v.is_active
        group by v.colour
      ) c
    ), '[]'::jsonb),
    count(*) over ()
  from listed l
  left join lateral (
    select m.r2_key, m.alt
    from public.product_media m
    where m.product_id = l.id
    order by m.sort_order
    limit 1
  ) img on true
  order by
    case when p_sort = 'price_asc' then l.price_paise end asc,
    case when p_sort = 'price_desc' then l.price_paise end desc,
    case when p_sort = 'relevance' then l.rank end desc,
    case when p_sort = 'featured' then l.collection_sort end asc,
    l.published_at desc nulls last,
    l.id
  limit least(greatest(p_limit, 1), 60)
  offset greatest(p_offset, 0);
$$;

-- ---------------------------------------------------------------------------
-- Facets: filter options available within a scope (before size/colour/price filters).
-- ---------------------------------------------------------------------------
create or replace function public.catalog_facets(
  p_collection_slug text default null,
  p_category_slug text default null,
  p_query text default null
)
returns jsonb
language sql
stable
set search_path = ''
as $$
  with scope as (
    select * from private.catalog_scope(p_collection_slug, p_category_slug, p_query)
  ),
  variants as (
    select v.size, v.colour, v.colour_hex, v.price_paise
    from public.product_variants v
    join scope s on s.product_id = v.product_id
    where v.is_active
  )
  select jsonb_build_object(
    'sizes', coalesce((
      select jsonb_agg(size order by
        coalesce(array_position(array['XS', 'S', 'M', 'L', 'XL', 'XXL', '3XL', 'Free Size'], size), 99), size)
      from (select distinct size from variants) s
    ), '[]'::jsonb),
    'colours', coalesce((
      select jsonb_agg(jsonb_build_object('name', colour, 'hex', colour_hex) order by colour)
      from (select colour, min(colour_hex) as colour_hex from variants group by colour) c
    ), '[]'::jsonb),
    'fabrics', coalesce((
      select jsonb_agg(fabric order by fabric)
      from (
        select distinct p.fabric
        from public.products p
        join scope s on s.product_id = p.id
        where p.fabric is not null
      ) f
    ), '[]'::jsonb),
    'min_paise', (select min(price_paise) from variants),
    'max_paise', (select max(price_paise) from variants)
  );
$$;

revoke all on function private.catalog_scope(text, text, text) from public;
revoke all on function public.catalog_products(text, text, text, text[], text[], text[], bigint, bigint, text, integer, integer) from public;
revoke all on function public.catalog_facets(text, text, text) from public;
grant execute on function private.catalog_scope(text, text, text) to anon, authenticated, service_role;
grant execute on function public.catalog_products(text, text, text, text[], text[], text[], bigint, bigint, text, integer, integer) to anon, authenticated, service_role;
grant execute on function public.catalog_facets(text, text, text) to anon, authenticated, service_role;

-- ---------------------------------------------------------------------------
-- Collections and categories share /collections/[slug], so their slugs must not collide.
-- ---------------------------------------------------------------------------
create or replace function private.reject_shared_listing_slug()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_table_name = 'categories'
     and exists (select 1 from public.collections c where c.slug = new.slug) then
    raise exception 'slug "%" is already used by a collection', new.slug using errcode = '23505';
  end if;
  if tg_table_name = 'collections'
     and exists (select 1 from public.categories c where c.slug = new.slug) then
    raise exception 'slug "%" is already used by a category', new.slug using errcode = '23505';
  end if;
  return new;
end;
$$;

create trigger categories_reject_shared_slug
  before insert or update of slug on public.categories
  for each row execute function private.reject_shared_listing_slug();

create trigger collections_reject_shared_slug
  before insert or update of slug on public.collections
  for each row execute function private.reject_shared_listing_slug();
