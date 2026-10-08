-- M9 admin catalog: transactional helpers for the admin catalog screens.
--
-- The save helpers are security invoker, so the admin write policies and the column grants on
-- products / product_variants from the catalog migration still apply (admins can set the initial
-- stock on insert but never update stock or reserved). Stock only changes through
-- admin_adjust_stock (AGENTS.md §5.5).

-- ---------------------------------------------------------------------------
-- Variants: insert new rows (with their opening stock) and update existing ones in one transaction.
-- p_variants: [{ id?, sku, size, colour, colour_hex?, mrp_paise, price_paise, weight_grams,
--               is_active, stock? (new rows only) }]
-- ---------------------------------------------------------------------------
create or replace function public.admin_save_variants(p_product_id uuid, p_variants jsonb)
returns void
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v jsonb;
begin
  if not (select private.is_admin()) then
    raise exception 'admin:forbidden' using errcode = '42501';
  end if;
  if jsonb_typeof(p_variants) is distinct from 'array' or jsonb_array_length(p_variants) > 200 then
    raise exception 'variants:invalid' using errcode = '22023';
  end if;

  for v in select value from jsonb_array_elements(p_variants) loop
    if nullif(v ->> 'id', '') is not null then
      update public.product_variants set
        sku = v ->> 'sku',
        size = v ->> 'size',
        colour = v ->> 'colour',
        colour_hex = nullif(v ->> 'colour_hex', ''),
        mrp_paise = (v ->> 'mrp_paise')::bigint,
        price_paise = (v ->> 'price_paise')::bigint,
        weight_grams = (v ->> 'weight_grams')::integer,
        is_active = (v ->> 'is_active')::boolean
      where id = (v ->> 'id')::uuid and product_id = p_product_id;
      if not found then
        raise exception 'variant:not_found' using errcode = 'P0002';
      end if;
    else
      insert into public.product_variants (
        product_id, sku, size, colour, colour_hex, mrp_paise, price_paise, weight_grams, stock, is_active
      ) values (
        p_product_id,
        v ->> 'sku',
        v ->> 'size',
        v ->> 'colour',
        nullif(v ->> 'colour_hex', ''),
        (v ->> 'mrp_paise')::bigint,
        (v ->> 'price_paise')::bigint,
        (v ->> 'weight_grams')::integer,
        coalesce((v ->> 'stock')::integer, 0),
        coalesce((v ->> 'is_active')::boolean, true)
      );
    end if;
  end loop;
end;
$$;

-- ---------------------------------------------------------------------------
-- Stock: add or remove units (received stock, damaged, recount). Never below what is reserved
-- for pending orders. Returns the new stock.
-- ---------------------------------------------------------------------------
create or replace function public.admin_adjust_stock(p_variant_id uuid, p_delta integer)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_stock integer;
  v_reserved integer;
begin
  if not (select private.is_admin()) then
    raise exception 'admin:forbidden' using errcode = '42501';
  end if;
  if p_delta is null or p_delta = 0 or abs(p_delta) > 100000 then
    raise exception 'stock:invalid_delta' using errcode = '22023';
  end if;

  select stock, reserved into v_stock, v_reserved
  from public.product_variants
  where id = p_variant_id
  for update;
  if not found then
    raise exception 'variant:not_found' using errcode = 'P0002';
  end if;
  if v_stock + p_delta < v_reserved then
    raise exception 'stock:below_reserved' using errcode = '23514';
  end if;

  update public.product_variants
  set stock = stock + p_delta
  where id = p_variant_id
  returning stock into v_stock;
  return v_stock;
end;
$$;

-- ---------------------------------------------------------------------------
-- Tags and collections for one product (replace the whole set).
-- ---------------------------------------------------------------------------
create or replace function public.admin_set_product_tags(p_product_id uuid, p_tag_ids uuid[])
returns void
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if not (select private.is_admin()) then
    raise exception 'admin:forbidden' using errcode = '42501';
  end if;
  delete from public.product_tags
  where product_id = p_product_id and tag_id <> all (coalesce(p_tag_ids, '{}'));
  insert into public.product_tags (product_id, tag_id)
  select p_product_id, t from unnest(coalesce(p_tag_ids, '{}')) as t
  on conflict do nothing;
end;
$$;

-- New memberships go to the end of each collection.
create or replace function public.admin_set_product_collections(p_product_id uuid, p_collection_ids uuid[])
returns void
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if not (select private.is_admin()) then
    raise exception 'admin:forbidden' using errcode = '42501';
  end if;
  delete from public.collection_products
  where product_id = p_product_id and collection_id <> all (coalesce(p_collection_ids, '{}'));
  insert into public.collection_products (collection_id, product_id, sort_order)
  select c, p_product_id, coalesce((
    select max(cp.sort_order) + 1 from public.collection_products cp where cp.collection_id = c
  ), 0)
  from unnest(coalesce(p_collection_ids, '{}')) as c
  on conflict do nothing;
end;
$$;

-- ---------------------------------------------------------------------------
-- Ordering: product images and collection members (the array order becomes sort_order).
-- ---------------------------------------------------------------------------
create or replace function public.admin_reorder_media(p_product_id uuid, p_media_ids uuid[])
returns void
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if not (select private.is_admin()) then
    raise exception 'admin:forbidden' using errcode = '42501';
  end if;
  update public.product_media m
  set sort_order = o.ord::integer
  from unnest(p_media_ids) with ordinality as o (id, ord)
  where m.id = o.id and m.product_id = p_product_id and m.sort_order is distinct from o.ord::integer;
end;
$$;

-- Replaces the collection's members with p_product_ids, in that order.
create or replace function public.admin_set_collection_products(p_collection_id uuid, p_product_ids uuid[])
returns void
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if not (select private.is_admin()) then
    raise exception 'admin:forbidden' using errcode = '42501';
  end if;
  delete from public.collection_products
  where collection_id = p_collection_id and product_id <> all (coalesce(p_product_ids, '{}'));
  insert into public.collection_products (collection_id, product_id, sort_order)
  select p_collection_id, o.id, o.ord::integer
  from unnest(coalesce(p_product_ids, '{}')) with ordinality as o (id, ord)
  on conflict (collection_id, product_id) do update set sort_order = excluded.sort_order
  where public.collection_products.sort_order is distinct from excluded.sort_order;
end;
$$;

-- ---------------------------------------------------------------------------
-- Grants: signed-in admins call these with their own session (the functions re-check the role).
-- ---------------------------------------------------------------------------
revoke all on function public.admin_save_variants(uuid, jsonb) from public, anon;
revoke all on function public.admin_adjust_stock(uuid, integer) from public, anon;
revoke all on function public.admin_set_product_tags(uuid, uuid[]) from public, anon;
revoke all on function public.admin_set_product_collections(uuid, uuid[]) from public, anon;
revoke all on function public.admin_reorder_media(uuid, uuid[]) from public, anon;
revoke all on function public.admin_set_collection_products(uuid, uuid[]) from public, anon;
grant execute on function public.admin_save_variants(uuid, jsonb) to authenticated;
grant execute on function public.admin_adjust_stock(uuid, integer) to authenticated;
grant execute on function public.admin_set_product_tags(uuid, uuid[]) to authenticated;
grant execute on function public.admin_set_product_collections(uuid, uuid[]) to authenticated;
grant execute on function public.admin_reorder_media(uuid, uuid[]) to authenticated;
grant execute on function public.admin_set_collection_products(uuid, uuid[]) to authenticated;
