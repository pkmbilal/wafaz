-- M5 cart: one server-side cart per auth.uid() (anonymous guests included), cart RPCs and the
-- cart part of merge_guest_into_user. See docs/DATA_MODEL.md §2 (Cart), §3 (RLS) and §5.

-- ---------------------------------------------------------------------------
-- carts / cart_items
-- ---------------------------------------------------------------------------
-- on delete cascade (not the usual restrict): the stale-guest cron and merge_guest_into_user
-- delete auth.users rows, and a cart has no value without its owner.
create table public.carts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique references auth.users (id) on delete cascade,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger carts_set_updated_at
  before update on public.carts
  for each row execute function private.set_updated_at();

create table public.cart_items (
  id uuid primary key default gen_random_uuid(),
  cart_id uuid not null references public.carts (id) on delete cascade,
  variant_id uuid not null references public.product_variants (id) on delete restrict,
  qty integer not null check (qty between 1 and 10),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (cart_id, variant_id)
);

create index cart_items_variant_id_idx on public.cart_items (variant_id);

create trigger cart_items_set_updated_at
  before update on public.cart_items
  for each row execute function private.set_updated_at();

-- ---------------------------------------------------------------------------
-- RLS: own rows (anonymous users are `authenticated`), admin read
-- ---------------------------------------------------------------------------
alter table public.carts enable row level security;
alter table public.cart_items enable row level security;

create policy "carts: read own or admin"
  on public.carts for select
  to authenticated
  using (user_id = (select auth.uid()) or (select private.is_admin()));

create policy "carts: insert own"
  on public.carts for insert
  to authenticated
  with check (user_id = (select auth.uid()));

create policy "carts: delete own"
  on public.carts for delete
  to authenticated
  using (user_id = (select auth.uid()));

create policy "cart_items: read own or admin"
  on public.cart_items for select
  to authenticated
  using (
    exists (select 1 from public.carts c where c.id = cart_id and c.user_id = (select auth.uid()))
    or (select private.is_admin())
  );

create policy "cart_items: insert own"
  on public.cart_items for insert
  to authenticated
  with check (exists (select 1 from public.carts c where c.id = cart_id and c.user_id = (select auth.uid())));

create policy "cart_items: update own"
  on public.cart_items for update
  to authenticated
  using (exists (select 1 from public.carts c where c.id = cart_id and c.user_id = (select auth.uid())))
  with check (exists (select 1 from public.carts c where c.id = cart_id and c.user_id = (select auth.uid())));

create policy "cart_items: delete own"
  on public.cart_items for delete
  to authenticated
  using (exists (select 1 from public.carts c where c.id = cart_id and c.user_id = (select auth.uid())));

revoke all on public.carts, public.cart_items from anon;
-- A cart row has nothing to edit; only the quantity of a line changes.
revoke update on public.carts from authenticated;
revoke update on public.cart_items from authenticated;
grant update (qty) on public.cart_items to authenticated;

-- ---------------------------------------------------------------------------
-- cart_add_item: get-or-create the caller's cart and add qty to a line in one statement.
-- The line is capped at 10 and at the stock available right now (stock - reserved). Adding to
-- the cart never reserves stock; checkout does. Returns the line qty after the add and the
-- qty that was asked for (existing + p_qty, capped at 10), so the caller can explain a shortfall.
-- ---------------------------------------------------------------------------
create or replace function public.cart_add_item(p_variant_id uuid, p_qty integer)
returns table (qty integer, requested integer, available integer)
language plpgsql
security invoker
set search_path = ''
as $$
#variable_conflict use_column
declare
  v_uid uuid := (select auth.uid());
  v_cart_id uuid;
  v_available integer;
  v_existing integer;
  v_requested integer;
  v_qty integer;
begin
  if v_uid is null then
    raise exception 'not signed in' using errcode = '42501';
  end if;
  if p_qty is null or p_qty < 1 or p_qty > 10 then
    raise exception 'qty must be between 1 and 10' using errcode = '22023';
  end if;

  -- RLS on product_variants hides inactive variants and products that aren't active.
  select greatest(0, v.stock - v.reserved) into v_available
  from public.product_variants v
  where v.id = p_variant_id;
  if not found then
    raise exception 'variant not available' using errcode = 'P0002';
  end if;

  insert into public.carts (user_id) values (v_uid)
  on conflict (user_id) do nothing;
  select c.id into v_cart_id from public.carts c where c.user_id = v_uid;

  select ci.qty into v_existing
  from public.cart_items ci
  where ci.cart_id = v_cart_id and ci.variant_id = p_variant_id
  for update;
  v_existing := coalesce(v_existing, 0);

  v_requested := least(10, v_existing + p_qty);
  -- Never lower an existing line here; the stepper does that.
  v_qty := greatest(v_existing, least(v_requested, v_available));

  if v_qty > 0 then
    insert into public.cart_items (cart_id, variant_id, qty)
    values (v_cart_id, p_variant_id, v_qty)
    on conflict (cart_id, variant_id) do update set qty = excluded.qty;
  end if;

  return query select v_qty, v_requested, v_available;
end;
$$;

revoke all on function public.cart_add_item(uuid, integer) from public, anon;
grant execute on function public.cart_add_item(uuid, integer) to authenticated;

-- ---------------------------------------------------------------------------
-- cart_set_qty: set a line's quantity (0 removes it), clamped to 1–10 and to available stock.
-- Returns the new qty (0 when removed).
-- ---------------------------------------------------------------------------
create or replace function public.cart_set_qty(p_item_id uuid, p_qty integer)
returns integer
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_variant_id uuid;
  v_available integer;
  v_qty integer;
begin
  if p_qty is null or p_qty < 0 or p_qty > 10 then
    raise exception 'qty must be between 0 and 10' using errcode = '22023';
  end if;

  -- RLS limits this to the caller's own lines.
  select ci.variant_id into v_variant_id
  from public.cart_items ci
  where ci.id = p_item_id
  for update;
  if not found then
    raise exception 'cart line not found' using errcode = 'P0002';
  end if;

  if p_qty = 0 then
    delete from public.cart_items where id = p_item_id;
    return 0;
  end if;

  select greatest(0, v.stock - v.reserved) into v_available
  from public.product_variants v
  where v.id = v_variant_id;
  -- An unavailable line can only be removed; keep it as it is otherwise.
  v_qty := greatest(1, least(p_qty, coalesce(v_available, 0)));

  update public.cart_items set qty = v_qty where id = p_item_id;
  return v_qty;
end;
$$;

revoke all on function public.cart_set_qty(uuid, integer) from public, anon;
grant execute on function public.cart_set_qty(uuid, integer) to authenticated;

-- ---------------------------------------------------------------------------
-- cart_lines: the caller's cart with product details, including lines whose variant or product
-- is no longer sold (RLS would hide those, so this is security definer and scoped to auth.uid()).
-- ---------------------------------------------------------------------------
create or replace function public.cart_lines()
returns table (
  item_id uuid,
  variant_id uuid,
  qty integer,
  product_slug text,
  title text,
  size text,
  colour text,
  price_paise bigint,
  mrp_paise bigint,
  available integer,
  purchasable boolean,
  image_key text,
  image_alt text
)
language sql
stable
security definer
set search_path = ''
as $$
  select
    ci.id,
    ci.variant_id,
    ci.qty,
    p.slug,
    p.title,
    v.size,
    v.colour,
    v.price_paise,
    v.mrp_paise,
    greatest(0, v.stock - v.reserved),
    v.is_active and p.status = 'active',
    m.r2_key,
    m.alt
  from public.carts c
  join public.cart_items ci on ci.cart_id = c.id
  join public.product_variants v on v.id = ci.variant_id
  join public.products p on p.id = v.product_id
  left join lateral (
    select pm.r2_key, pm.alt
    from public.product_media pm
    where pm.product_id = p.id and (pm.colour = v.colour or pm.colour is null)
    order by (pm.colour is null), pm.sort_order
    limit 1
  ) m on true
  where c.user_id = (select auth.uid())
  order by ci.created_at, ci.id;
$$;

revoke all on function public.cart_lines() from public, anon;
grant execute on function public.cart_lines() to authenticated;

-- ---------------------------------------------------------------------------
-- merge_guest_into_user: now also merges cart lines (sum quantities, cap at 10).
-- ---------------------------------------------------------------------------
create or replace function public.merge_guest_into_user(p_anon_uid uuid, p_user_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if p_anon_uid = p_user_id then
    return;
  end if;

  if not exists (select 1 from auth.users where id = p_anon_uid and is_anonymous) then
    raise exception 'source user is not an anonymous user' using errcode = '22023';
  end if;

  if not exists (select 1 from auth.users where id = p_user_id and not is_anonymous) then
    raise exception 'target user is not a registered user' using errcode = '22023';
  end if;

  -- Keep the account's default address if it has one.
  update public.addresses a
  set user_id = p_user_id,
      is_default = a.is_default
        and not exists (select 1 from public.addresses d where d.user_id = p_user_id and d.is_default)
  where a.user_id = p_anon_uid;

  update public.profiles p
  set full_name = coalesce(p.full_name, g.full_name)
  from public.profiles g
  where p.id = p_user_id and g.id = p_anon_uid;

  -- Cart: copy the guest's lines into the account's cart. The guest cart goes with the
  -- anonymous user below (on delete cascade).
  if exists (
    select 1 from public.cart_items ci join public.carts c on c.id = ci.cart_id
    where c.user_id = p_anon_uid
  ) then
    insert into public.carts (user_id) values (p_user_id)
    on conflict (user_id) do nothing;

    insert into public.cart_items (cart_id, variant_id, qty)
    select t.id, gi.variant_id, gi.qty
    from public.cart_items gi
    join public.carts g on g.id = gi.cart_id and g.user_id = p_anon_uid
    cross join (select id from public.carts where user_id = p_user_id) t
    on conflict (cart_id, variant_id)
      do update set qty = least(10, public.cart_items.qty + excluded.qty);
  end if;

  -- TODO(M6): reassign the guest's orders.

  delete from auth.users where id = p_anon_uid;
end;
$$;

revoke all on function public.merge_guest_into_user(uuid, uuid) from public, anon, authenticated;
grant execute on function public.merge_guest_into_user(uuid, uuid) to service_role;
