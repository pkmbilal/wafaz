-- M6 checkout and payments: coupons, orders, payments, refunds, webhook log, gapless document
-- numbering, invoices, and the order/stock DB functions.
-- See docs/DATA_MODEL.md §2 (tables), §3 (RLS), §4 (status machines), §5 (functions), §6 (GST).

-- ---------------------------------------------------------------------------
-- coupons
-- ---------------------------------------------------------------------------
create table public.coupons (
  id uuid primary key default gen_random_uuid(),
  code text not null unique check (code = upper(code) and code ~ '^[A-Z0-9][A-Z0-9-]{2,29}$'),
  kind text not null check (kind in ('percent', 'flat')),
  -- percent: whole percent (1–100); flat: paise.
  value bigint not null check (value > 0),
  max_discount_paise bigint check (max_discount_paise > 0),
  min_cart_paise bigint not null default 0 check (min_cart_paise >= 0),
  max_uses integer check (max_uses > 0),
  per_user_limit integer check (per_user_limit > 0),
  first_order_only boolean not null default false,
  used_count integer not null default 0 check (used_count >= 0),
  starts_at timestamptz,
  ends_at timestamptz,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (kind <> 'percent' or value between 1 and 100),
  check (ends_at is null or starts_at is null or ends_at > starts_at)
);

create trigger coupons_set_updated_at
  before update on public.coupons
  for each row execute function private.set_updated_at();

-- ---------------------------------------------------------------------------
-- orders
-- ---------------------------------------------------------------------------
-- A plain sequence is fine for order numbers (gaps allowed); invoices use next_document_number().
create sequence public.order_number_seq;

create table public.orders (
  id uuid primary key default gen_random_uuid(),
  number text not null unique default ('ORD-' || lpad(nextval('public.order_number_seq')::text, 6, '0')),
  -- restrict: guests with orders are never cleaned up; merge reassigns orders before deleting.
  user_id uuid not null references auth.users (id) on delete restrict,
  email text not null check (char_length(email) between 3 and 254),
  phone text not null check (phone ~ '^\+91[6-9]\d{9}$'),
  order_status text not null default 'pending_payment'
    check (order_status in ('pending_payment', 'confirmed', 'cancelled', 'expired', 'completed')),
  payment_status text not null default 'unpaid'
    check (payment_status in ('unpaid', 'paid', 'partially_refunded', 'refunded', 'failed')),
  fulfillment_status text not null default 'unfulfilled'
    check (fulfillment_status in ('unfulfilled', 'packed', 'shipped', 'delivered', 'returned_to_origin')),
  expires_at timestamptz,
  needs_attention boolean not null default false,
  attention_reason text check (char_length(attention_reason) <= 500),
  coupon_id uuid references public.coupons (id) on delete restrict,
  coupon_code text,
  -- All GST-inclusive. total = subtotal - discount + shipping.
  subtotal_paise bigint not null check (subtotal_paise >= 0),
  discount_paise bigint not null default 0 check (discount_paise >= 0),
  shipping_paise bigint not null default 0 check (shipping_paise >= 0),
  total_paise bigint not null check (total_paise >= 100),
  -- Tax totals include the shipping line.
  taxable_total_paise bigint not null check (taxable_total_paise >= 0),
  cgst_paise bigint not null default 0 check (cgst_paise >= 0),
  sgst_paise bigint not null default 0 check (sgst_paise >= 0),
  igst_paise bigint not null default 0 check (igst_paise >= 0),
  shipping_gst_rate_bps integer not null default 0 check (shipping_gst_rate_bps between 0 and 10000),
  shipping_taxable_paise bigint not null default 0 check (shipping_taxable_paise >= 0),
  place_of_supply_code text not null references public.indian_states (code) on delete restrict,
  shipping_address jsonb not null,
  billing_address jsonb not null,
  total_weight_grams integer not null check (total_weight_grams > 0),
  shipping_zone_id uuid references public.shipping_zones (id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (total_paise = subtotal_paise - discount_paise + shipping_paise)
);

create index orders_user_id_created_idx on public.orders (user_id, created_at desc);
create index orders_coupon_id_idx on public.orders (coupon_id);
create index orders_place_of_supply_code_idx on public.orders (place_of_supply_code);
create index orders_shipping_zone_id_idx on public.orders (shipping_zone_id);
create index orders_email_idx on public.orders (lower(email));
create index orders_phone_idx on public.orders (phone);
create index orders_pending_expiry_idx on public.orders (expires_at) where order_status = 'pending_payment';
create index orders_needs_attention_idx on public.orders (created_at) where needs_attention;
create index orders_statuses_idx on public.orders (order_status, payment_status, fulfillment_status);

create trigger orders_set_updated_at
  before update on public.orders
  for each row execute function private.set_updated_at();

create table public.order_items (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders (id) on delete restrict,
  variant_id uuid not null references public.product_variants (id) on delete restrict,
  product_id uuid not null references public.products (id) on delete restrict,
  product_title text not null,
  product_slug text not null,
  sku text not null,
  size text not null,
  colour text not null,
  image_key text,
  hsn_code text not null,
  unit_price_paise bigint not null check (unit_price_paise > 0),
  mrp_paise bigint not null check (mrp_paise > 0),
  qty integer not null check (qty between 1 and 10),
  line_gross_paise bigint not null check (line_gross_paise >= 0),
  line_discount_paise bigint not null default 0 check (line_discount_paise >= 0),
  line_net_paise bigint not null check (line_net_paise >= 0),
  gst_rate_bps integer not null check (gst_rate_bps between 0 and 10000),
  taxable_paise bigint not null check (taxable_paise >= 0),
  cgst_paise bigint not null default 0 check (cgst_paise >= 0),
  sgst_paise bigint not null default 0 check (sgst_paise >= 0),
  igst_paise bigint not null default 0 check (igst_paise >= 0),
  refunded_qty integer not null default 0 check (refunded_qty between 0 and qty),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (order_id, variant_id),
  check (line_net_paise = line_gross_paise - line_discount_paise),
  check (line_net_paise = taxable_paise + cgst_paise + sgst_paise + igst_paise)
);

create index order_items_variant_id_idx on public.order_items (variant_id);
create index order_items_product_id_idx on public.order_items (product_id);

create trigger order_items_set_updated_at
  before update on public.order_items
  for each row execute function private.set_updated_at();

create table public.order_events (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders (id) on delete restrict,
  field text not null check (field in ('order_status', 'payment_status', 'fulfillment_status', 'note')),
  from_value text,
  to_value text,
  note text check (char_length(note) <= 1000),
  -- null = system
  actor_id uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index order_events_order_id_idx on public.order_events (order_id, created_at);
create index order_events_actor_id_idx on public.order_events (actor_id);

create trigger order_events_set_updated_at
  before update on public.order_events
  for each row execute function private.set_updated_at();

create table public.coupon_redemptions (
  id uuid primary key default gen_random_uuid(),
  coupon_id uuid not null references public.coupons (id) on delete restrict,
  order_id uuid not null unique references public.orders (id) on delete restrict,
  user_id uuid references auth.users (id) on delete set null,
  email_norm text,
  phone_e164 text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index coupon_redemptions_coupon_id_idx on public.coupon_redemptions (coupon_id);
create index coupon_redemptions_user_id_idx on public.coupon_redemptions (user_id);
create index coupon_redemptions_email_idx on public.coupon_redemptions (coupon_id, email_norm);
create index coupon_redemptions_phone_idx on public.coupon_redemptions (coupon_id, phone_e164);

create trigger coupon_redemptions_set_updated_at
  before update on public.coupon_redemptions
  for each row execute function private.set_updated_at();

-- ---------------------------------------------------------------------------
-- payments, refunds, webhook_events
-- ---------------------------------------------------------------------------
create table public.payments (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders (id) on delete restrict,
  razorpay_order_id text not null unique,
  razorpay_payment_id text unique,
  status text not null default 'created' check (status in ('created', 'captured', 'failed')),
  amount_paise bigint not null check (amount_paise >= 100),
  method text,
  raw jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index payments_order_id_idx on public.payments (order_id);

create trigger payments_set_updated_at
  before update on public.payments
  for each row execute function private.set_updated_at();

create table public.refunds (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders (id) on delete restrict,
  payment_id uuid not null references public.payments (id) on delete restrict,
  razorpay_refund_id text unique,
  amount_paise bigint not null check (amount_paise > 0),
  reason text not null check (char_length(reason) <= 500),
  status text not null default 'pending' check (status in ('pending', 'processed', 'failed')),
  -- null = system
  created_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index refunds_order_id_idx on public.refunds (order_id);
create index refunds_payment_id_idx on public.refunds (payment_id);
create index refunds_created_by_idx on public.refunds (created_by);

create trigger refunds_set_updated_at
  before update on public.refunds
  for each row execute function private.set_updated_at();

create table public.webhook_events (
  id uuid primary key default gen_random_uuid(),
  provider text not null default 'razorpay' check (provider in ('razorpay')),
  event_id text not null unique,
  event_type text not null,
  payload jsonb not null,
  status text not null default 'received' check (status in ('received', 'processed', 'failed')),
  error text check (char_length(error) <= 2000),
  attempts integer not null default 0 check (attempts >= 0),
  processed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- "Needs attention": failed webhooks.
create index webhook_events_status_created_idx on public.webhook_events (status, created_at);

create trigger webhook_events_set_updated_at
  before update on public.webhook_events
  for each row execute function private.set_updated_at();

-- ---------------------------------------------------------------------------
-- document_sequences, invoices
-- ---------------------------------------------------------------------------
create table public.document_sequences (
  doc_type text not null check (doc_type in ('invoice', 'credit_note')),
  fiscal_year text not null check (fiscal_year ~ '^\d{2}-\d{2}$'),
  last_value integer not null check (last_value > 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (doc_type, fiscal_year)
);

create trigger document_sequences_set_updated_at
  before update on public.document_sequences
  for each row execute function private.set_updated_at();

create table public.invoices (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null unique references public.orders (id) on delete restrict,
  number text not null unique check (char_length(number) <= 16),
  issued_at timestamptz not null default now(),
  fiscal_year text not null,
  seller_snapshot jsonb not null,
  buyer_snapshot jsonb not null,
  place_of_supply_code text not null references public.indian_states (code) on delete restrict,
  totals jsonb not null,
  lines jsonb not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index invoices_place_of_supply_code_idx on public.invoices (place_of_supply_code);

-- Invoices are never updated (AGENTS.md §5.2).
create or replace function private.reject_update()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  raise exception '% rows are immutable', tg_table_name using errcode = '42501';
end;
$$;

create trigger invoices_immutable
  before update or delete on public.invoices
  for each row execute function private.reject_update();

-- ---------------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------------
alter table public.coupons enable row level security;
alter table public.orders enable row level security;
alter table public.order_items enable row level security;
alter table public.order_events enable row level security;
alter table public.coupon_redemptions enable row level security;
alter table public.payments enable row level security;
alter table public.refunds enable row level security;
alter table public.webhook_events enable row level security;
alter table public.document_sequences enable row level security;
alter table public.invoices enable row level security;

create policy "orders: read own or admin" on public.orders for select to authenticated
  using (user_id = (select auth.uid()) or (select private.is_admin()));

create policy "order_items: read own or admin" on public.order_items for select to authenticated
  using (
    exists (select 1 from public.orders o where o.id = order_id and o.user_id = (select auth.uid()))
    or (select private.is_admin())
  );

create policy "order_events: read own or admin" on public.order_events for select to authenticated
  using (
    exists (select 1 from public.orders o where o.id = order_id and o.user_id = (select auth.uid()))
    or (select private.is_admin())
  );

create policy "invoices: read own or admin" on public.invoices for select to authenticated
  using (
    exists (select 1 from public.orders o where o.id = order_id and o.user_id = (select auth.uid()))
    or (select private.is_admin())
  );

create policy "coupons: admin read" on public.coupons for select to authenticated
  using ((select private.is_admin()));
create policy "coupons: admin insert" on public.coupons for insert to authenticated
  with check ((select private.is_admin()));
create policy "coupons: admin update" on public.coupons for update to authenticated
  using ((select private.is_admin())) with check ((select private.is_admin()));

create policy "coupon_redemptions: admin read" on public.coupon_redemptions for select to authenticated
  using ((select private.is_admin()));
create policy "payments: admin read" on public.payments for select to authenticated
  using ((select private.is_admin()));
create policy "refunds: admin read" on public.refunds for select to authenticated
  using ((select private.is_admin()));
create policy "document_sequences: admin read" on public.document_sequences for select to authenticated
  using ((select private.is_admin()));
create policy "webhook_events: owner read" on public.webhook_events for select to authenticated
  using ((select private.is_owner()));

-- Customers never write orders, payments or documents; DB functions do (DATA_MODEL §3).
revoke all on public.orders, public.order_items, public.order_events, public.coupon_redemptions,
  public.payments, public.refunds, public.webhook_events, public.document_sequences, public.invoices,
  public.coupons
from anon;
revoke insert, update, delete on public.orders, public.order_items, public.order_events,
  public.coupon_redemptions, public.payments, public.refunds, public.webhook_events,
  public.document_sequences, public.invoices
from authenticated;
-- Admins manage coupons (M8) but never touch the redemption counter directly.
revoke delete, update on public.coupons from authenticated;
grant update (code, kind, value, max_discount_paise, min_cart_paise, max_uses, per_user_limit,
              first_order_only, starts_at, ends_at, is_active)
  on public.coupons to authenticated;
revoke usage on sequence public.order_number_seq from anon, authenticated;

-- ---------------------------------------------------------------------------
-- Helpers
-- ---------------------------------------------------------------------------
-- Indian financial year (April–March) of a timestamp in IST, e.g. '26-27'.
create or replace function private.fiscal_year(p_at timestamptz)
returns text
language sql
immutable
set search_path = ''
as $$
  select case
    when extract(month from (p_at at time zone 'Asia/Kolkata')) >= 4
      then to_char((p_at at time zone 'Asia/Kolkata'), 'YY') || '-'
        || to_char((p_at at time zone 'Asia/Kolkata') + interval '1 year', 'YY')
    else to_char((p_at at time zone 'Asia/Kolkata') - interval '1 year', 'YY') || '-'
        || to_char((p_at at time zone 'Asia/Kolkata'), 'YY')
  end;
$$;

-- Gapless, per financial year. Must run inside the transaction that uses the number: a rollback
-- also rolls back the increment, which is why this is not a Postgres sequence.
create or replace function public.next_document_number(p_doc_type text, p_issued_at timestamptz)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_fy text := private.fiscal_year(p_issued_at);
  v_next integer;
  v_prefix text;
begin
  insert into public.document_sequences as ds (doc_type, fiscal_year, last_value)
  values (p_doc_type, v_fy, 1)
  on conflict (doc_type, fiscal_year) do update set last_value = ds.last_value + 1
  returning ds.last_value into v_next;

  select case p_doc_type when 'invoice' then s.invoice_prefix else s.credit_note_prefix end
  into v_prefix
  from public.store_settings s
  where s.id = 1;

  return v_prefix || '/' || v_fy || '/' || lpad(v_next::text, 5, '0');
end;
$$;

-- Status machines (DATA_MODEL §4). Every change goes through here and is logged.
create or replace function public.transition_order(
  p_order_id uuid,
  p_field text,
  p_to_value text,
  p_note text default null,
  p_actor_id uuid default null
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_order public.orders%rowtype;
  v_from text;
  v_allowed text[];
begin
  select * into v_order from public.orders where id = p_order_id for update;
  if not found then
    raise exception 'order not found' using errcode = 'P0002';
  end if;

  if p_field = 'note' then
    insert into public.order_events (order_id, field, note, actor_id)
    values (p_order_id, 'note', p_note, p_actor_id);
    return;
  end if;

  v_from := case p_field
    when 'order_status' then v_order.order_status
    when 'payment_status' then v_order.payment_status
    when 'fulfillment_status' then v_order.fulfillment_status
  end;
  if v_from is null then
    raise exception 'unknown status field %', p_field using errcode = '22023';
  end if;

  v_allowed := case p_field
    when 'order_status' then array[
      'pending_payment>confirmed', 'pending_payment>expired', 'pending_payment>cancelled',
      'expired>confirmed', 'confirmed>cancelled', 'confirmed>completed']
    when 'payment_status' then array[
      'unpaid>paid', 'unpaid>failed', 'failed>paid',
      'paid>partially_refunded', 'paid>refunded', 'partially_refunded>refunded']
    else array[
      'unfulfilled>packed', 'packed>shipped', 'shipped>delivered', 'shipped>returned_to_origin']
  end;

  if not (v_from || '>' || p_to_value) = any (v_allowed) then
    raise exception 'invalid % transition: % -> %', p_field, v_from, p_to_value using errcode = '22023';
  end if;
  if p_field = 'fulfillment_status' and v_order.order_status <> 'confirmed' then
    raise exception 'fulfillment changes need a confirmed order' using errcode = '22023';
  end if;

  update public.orders set
    order_status = case when p_field = 'order_status' then p_to_value else order_status end,
    payment_status = case when p_field = 'payment_status' then p_to_value else payment_status end,
    fulfillment_status = case when p_field = 'fulfillment_status' then p_to_value else fulfillment_status end,
    expires_at = case when p_field = 'order_status' and p_to_value <> 'pending_payment' then null else expires_at end
  where id = p_order_id;

  insert into public.order_events (order_id, field, from_value, to_value, note, actor_id)
  values (p_order_id, p_field, v_from, p_to_value, p_note, p_actor_id);
end;
$$;

-- ---------------------------------------------------------------------------
-- GST (DATA_MODEL §6). lib/gst mirrors this for display; this result is authoritative.
-- ---------------------------------------------------------------------------
-- Rate for one line, testing the per-piece value (line_net / qty) as an exact fraction.
create or replace function private.gst_rate_bps(
  p_hsn_code text,
  p_line_net bigint,
  p_qty integer,
  p_on date,
  p_basis text
)
returns integer
language plpgsql
stable
set search_path = ''
as $$
declare
  v_rates integer[];
begin
  -- Inclusive basis: min < line_net/qty <= max.
  -- Taxable basis: the same test on line_net/qty × 10000/(10000 + rate), using each slab's own rate.
  select array_agg(t.rate_bps) into v_rates
  from public.tax_slabs t,
       lateral (select case when p_basis = 'taxable' then 10000 + t.rate_bps else 10000 end as d) k
  where t.hsn_code = p_hsn_code
    and t.effective_from <= p_on
    and (t.effective_to is null or t.effective_to > p_on)
    and (
      (t.min_unit_paise = 0 and p_line_net >= 0)
      or t.min_unit_paise::numeric * p_qty * k.d < p_line_net::numeric * 10000
    )
    and (
      t.max_unit_paise is null
      or p_line_net::numeric * 10000 <= t.max_unit_paise::numeric * p_qty * k.d
    );

  if coalesce(array_length(v_rates, 1), 0) <> 1 then
    raise exception 'no single GST slab for HSN % (% matches)', p_hsn_code, coalesce(array_length(v_rates, 1), 0)
      using errcode = 'P0001';
  end if;
  return v_rates[1];
end;
$$;

-- taxable = round(net × 10000 / (10000 + rate)), half-up; tax split by place of supply.
create or replace function private.gst_split(p_net bigint, p_rate_bps integer, p_intra_state boolean)
returns table (taxable bigint, cgst bigint, sgst bigint, igst bigint)
language sql
immutable
set search_path = ''
as $$
  with t as (
    select round(p_net::numeric * 10000 / (10000 + p_rate_bps))::bigint as taxable
  )
  select
    t.taxable,
    case when p_intra_state then (p_net - t.taxable) / 2 else 0 end,
    case when p_intra_state then (p_net - t.taxable) - (p_net - t.taxable) / 2 else 0 end,
    case when p_intra_state then 0 else p_net - t.taxable end
  from t;
$$;

-- Shipping charge for a state, parcel weight and merchandise value after discount.
create or replace function private.shipping_quote(p_state_code text, p_weight_grams integer, p_merch_net bigint)
returns table (zone_id uuid, charge_paise bigint)
language sql
stable
set search_path = ''
as $$
  select
    z.id,
    case
      when z.free_above_paise is not null and p_merch_net >= z.free_above_paise then 0
      else z.base_paise
        + ceil(greatest(0, p_weight_grams - z.base_weight_grams)::numeric / 500)::bigint
          * z.per_additional_500g_paise
    end
  from public.shipping_zones z
  where z.is_active and p_state_code = any (z.state_codes)
  order by z.name
  limit 1;
$$;

-- Settings the checkout preview needs (lib/pricing.ts). Not sensitive; store_settings itself
-- stays admin-only.
create or replace function public.checkout_tax_settings()
returns table (state_code text, tax_slab_basis text, shipping_tax_rate_bps integer)
language sql
stable
security definer
set search_path = ''
as $$
  select s.state_code, s.tax_slab_basis, s.shipping_tax_rate_bps from public.store_settings s where s.id = 1;
$$;

revoke all on function public.checkout_tax_settings() from public;
grant execute on function public.checkout_tax_settings() to anon, authenticated, service_role;

-- ---------------------------------------------------------------------------
-- Coupons
-- ---------------------------------------------------------------------------
-- Raises P0001 with a 'coupon:<reason>' message when the coupon can't be used. Matches limits on
-- user id, normalised email OR phone so a fresh guest session can't reuse a coupon.
create or replace function private.coupon_discount(
  p_code text,
  p_user_id uuid,
  p_email_norm text,
  p_phone text,
  p_merch_paise bigint,
  p_exclude_order uuid default null
)
returns table (coupon_id uuid, code text, discount_paise bigint)
language plpgsql
stable
set search_path = ''
as $$
#variable_conflict use_column
declare
  v_coupon public.coupons%rowtype;
  v_uses integer;
  v_discount bigint;
begin
  select * into v_coupon from public.coupons c where c.code = upper(trim(p_code));
  if not found or not v_coupon.is_active then
    raise exception 'coupon:invalid' using errcode = 'P0001';
  end if;
  if (v_coupon.starts_at is not null and now() < v_coupon.starts_at)
     or (v_coupon.ends_at is not null and now() >= v_coupon.ends_at) then
    raise exception 'coupon:expired' using errcode = 'P0001';
  end if;
  if p_merch_paise < v_coupon.min_cart_paise then
    raise exception 'coupon:min_cart' using errcode = 'P0001';
  end if;
  if v_coupon.max_uses is not null and v_coupon.used_count >= v_coupon.max_uses then
    raise exception 'coupon:exhausted' using errcode = 'P0001';
  end if;

  if v_coupon.per_user_limit is not null then
    select count(*) into v_uses
    from public.coupon_redemptions r
    where r.coupon_id = v_coupon.id
      and (p_exclude_order is null or r.order_id <> p_exclude_order)
      and (r.user_id = p_user_id or r.email_norm = p_email_norm or r.phone_e164 = p_phone);
    if v_uses >= v_coupon.per_user_limit then
      raise exception 'coupon:used' using errcode = 'P0001';
    end if;
  end if;

  if v_coupon.first_order_only and exists (
    select 1 from public.orders o
    where o.payment_status in ('paid', 'partially_refunded', 'refunded')
      and (p_exclude_order is null or o.id <> p_exclude_order)
      and (o.user_id = p_user_id or lower(o.email) = p_email_norm or o.phone = p_phone)
  ) then
    raise exception 'coupon:first_order' using errcode = 'P0001';
  end if;

  -- Discounts round down so we never overstate them; a flat coupon is clamped to the subtotal.
  v_discount := case v_coupon.kind
    when 'percent' then (p_merch_paise * v_coupon.value) / 100
    else v_coupon.value
  end;
  if v_coupon.max_discount_paise is not null then
    v_discount := least(v_discount, v_coupon.max_discount_paise);
  end if;
  v_discount := least(v_discount, p_merch_paise);

  return query select v_coupon.id, v_coupon.code, v_discount;
end;
$$;

-- What the checkout preview needs to validate a coupon in lib/pricing.ts: the coupon's rules and
-- this customer's usage. Signed-in callers only; the server action rate-limits it.
create or replace function public.coupon_for_checkout(p_code text, p_email text, p_phone text)
returns table (
  id uuid,
  code text,
  kind text,
  value bigint,
  max_discount_paise bigint,
  min_cart_paise bigint,
  first_order_only boolean,
  is_active boolean,
  starts_at timestamptz,
  ends_at timestamptz,
  exhausted boolean,
  customer_uses integer,
  per_user_limit integer,
  has_paid_order boolean
)
language sql
stable
security definer
set search_path = ''
as $$
  select
    c.id, c.code, c.kind, c.value, c.max_discount_paise, c.min_cart_paise, c.first_order_only,
    c.is_active, c.starts_at, c.ends_at,
    c.max_uses is not null and c.used_count >= c.max_uses,
    (select count(*)::integer from public.coupon_redemptions r
      where r.coupon_id = c.id
        and (r.user_id = (select auth.uid()) or r.email_norm = lower(trim(p_email)) or r.phone_e164 = p_phone)),
    c.per_user_limit,
    exists (select 1 from public.orders o
      where o.payment_status in ('paid', 'partially_refunded', 'refunded')
        and (o.user_id = (select auth.uid()) or lower(o.email) = lower(trim(p_email)) or o.phone = p_phone))
  from public.coupons c
  where c.code = upper(trim(p_code)) and (select auth.uid()) is not null;
$$;

-- ---------------------------------------------------------------------------
-- Stock
-- ---------------------------------------------------------------------------
-- Locks variant rows in variant_id order (no deadlocks) and fails the whole order on any shortfall.
create or replace function public.reserve_stock(p_order_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  r record;
begin
  for r in
    select oi.variant_id, oi.qty from public.order_items oi
    where oi.order_id = p_order_id
    order by oi.variant_id
  loop
    update public.product_variants v
    set reserved = v.reserved + r.qty
    where v.id = r.variant_id and v.stock - v.reserved >= r.qty;
    if not found then
      raise exception 'insufficient_stock' using errcode = 'P0001', detail = r.variant_id::text;
    end if;
  end loop;
end;
$$;

create or replace function private.release_stock(p_order_id uuid)
returns void
language plpgsql
set search_path = ''
as $$
declare
  r record;
begin
  for r in
    select oi.variant_id, oi.qty from public.order_items oi
    where oi.order_id = p_order_id
    order by oi.variant_id
  loop
    update public.product_variants v set reserved = greatest(0, v.reserved - r.qty) where v.id = r.variant_id;
  end loop;
end;
$$;

-- ---------------------------------------------------------------------------
-- create_order_from_cart: called as the customer (auth.uid()). Recalculates everything from the
-- DB, inserts the order and items, reserves stock for 30 minutes. The cart is kept until payment.
-- p_address keys: name, phone, line1, line2, city, state_code, pincode.
-- ---------------------------------------------------------------------------
create or replace function public.create_order_from_cart(
  p_address jsonb,
  p_email text,
  p_phone text,
  p_coupon_code text default null
)
returns table (order_id uuid, order_number text, total_paise bigint)
language plpgsql
security definer
set search_path = ''
as $$
#variable_conflict use_column
declare
  v_uid uuid := (select auth.uid());
  v_email text := lower(trim(p_email));
  v_state text := p_address ->> 'state_code';
  v_state_name text;
  v_settings public.store_settings%rowtype;
  v_today date := (now() at time zone 'Asia/Kolkata')::date;
  v_intra boolean;
  v_address jsonb;
  v_lines jsonb := '[]'::jsonb;
  v_line record;
  v_count integer;
  v_merch bigint := 0;
  v_weight integer := 0;
  v_coupon_id uuid;
  v_coupon_code text;
  v_discount bigint := 0;
  v_alloc bigint;
  v_allocated bigint := 0;
  v_largest integer;
  v_zone_id uuid;
  v_shipping bigint;
  v_ship_rate integer;
  v_ship_tax record;
  v_order_id uuid;
  v_number text;
  v_max_rate integer := 0;
  v_rate integer;
  v_tax record;
  v_net bigint;
  i integer;
begin
  if v_uid is null then
    raise exception 'not signed in' using errcode = '42501';
  end if;

  -- Contact and address (also validated with Zod before this is called).
  if v_email !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' or char_length(v_email) > 254 then
    raise exception 'checkout:email' using errcode = 'P0001';
  end if;
  if p_phone !~ '^\+91[6-9]\d{9}$' then
    raise exception 'checkout:phone' using errcode = 'P0001';
  end if;
  select s.name into v_state_name from public.indian_states s where s.code = v_state;
  if v_state_name is null
     or coalesce(p_address ->> 'pincode', '') !~ '^[1-9]\d{5}$'
     or coalesce(p_address ->> 'phone', '') !~ '^\+91[6-9]\d{9}$'
     or char_length(coalesce(trim(p_address ->> 'name'), '')) not between 1 and 120
     or char_length(coalesce(trim(p_address ->> 'line1'), '')) not between 1 and 200
     or char_length(coalesce(trim(p_address ->> 'line2'), '')) > 200
     or char_length(coalesce(trim(p_address ->> 'city'), '')) not between 1 and 100 then
    raise exception 'checkout:address' using errcode = 'P0001';
  end if;
  v_address := jsonb_build_object(
    'name', trim(p_address ->> 'name'),
    'phone', p_address ->> 'phone',
    'line1', trim(p_address ->> 'line1'),
    'line2', nullif(trim(coalesce(p_address ->> 'line2', '')), ''),
    'city', trim(p_address ->> 'city'),
    'state_code', v_state,
    'state_name', v_state_name,
    'pincode', p_address ->> 'pincode'
  );

  select * into v_settings from public.store_settings where id = 1;
  v_intra := v_state = v_settings.state_code;

  -- Cart lines priced from the DB, in variant_id order (the remainder rule depends on it).
  select count(*) into v_count
  from public.carts c join public.cart_items ci on ci.cart_id = c.id
  where c.user_id = v_uid;
  if v_count = 0 then
    raise exception 'checkout:empty' using errcode = 'P0001';
  end if;

  for v_line in
    select ci.variant_id, ci.qty, v.product_id, v.sku, v.size, v.colour, v.price_paise, v.mrp_paise,
           v.weight_grams, v.is_active and p.status = 'active' as purchasable,
           p.title, p.slug, p.hsn_code,
           (select pm.r2_key from public.product_media pm
             where pm.product_id = p.id and (pm.colour = v.colour or pm.colour is null)
             order by (pm.colour is null), pm.sort_order limit 1) as image_key
    from public.carts c
    join public.cart_items ci on ci.cart_id = c.id
    join public.product_variants v on v.id = ci.variant_id
    join public.products p on p.id = v.product_id
    where c.user_id = v_uid
    order by ci.variant_id
  loop
    if not v_line.purchasable then
      raise exception 'checkout:unavailable' using errcode = 'P0001';
    end if;
    v_lines := v_lines || jsonb_build_object(
      'variant_id', v_line.variant_id, 'product_id', v_line.product_id, 'qty', v_line.qty,
      'sku', v_line.sku, 'size', v_line.size, 'colour', v_line.colour, 'title', v_line.title,
      'slug', v_line.slug, 'hsn_code', v_line.hsn_code, 'image_key', v_line.image_key,
      'unit_price', v_line.price_paise, 'mrp', v_line.mrp_paise,
      'gross', v_line.price_paise * v_line.qty
    );
    v_merch := v_merch + v_line.price_paise * v_line.qty;
    v_weight := v_weight + v_line.weight_grams * v_line.qty;
  end loop;

  -- Coupon (merchandise only, never shipping).
  if nullif(trim(coalesce(p_coupon_code, '')), '') is not null then
    select cd.coupon_id, cd.code, cd.discount_paise into v_coupon_id, v_coupon_code, v_discount
    from private.coupon_discount(p_coupon_code, v_uid, v_email, p_phone, v_merch) cd;
  end if;

  -- Allocate the discount in proportion to line value; the remainder goes to the largest line
  -- (first in variant_id order on a tie).
  v_largest := 0;
  for i in 0 .. jsonb_array_length(v_lines) - 1 loop
    if (v_lines -> i ->> 'gross')::bigint > (v_lines -> v_largest ->> 'gross')::bigint then
      v_largest := i;
    end if;
  end loop;
  for i in 0 .. jsonb_array_length(v_lines) - 1 loop
    v_alloc := case when v_merch = 0 then 0
      else (v_discount * (v_lines -> i ->> 'gross')::bigint) / v_merch end;
    v_lines := jsonb_set(v_lines, array[i::text, 'discount'], to_jsonb(v_alloc));
    v_allocated := v_allocated + v_alloc;
  end loop;
  v_lines := jsonb_set(v_lines, array[v_largest::text, 'discount'],
    to_jsonb((v_lines -> v_largest ->> 'discount')::bigint + (v_discount - v_allocated)));

  -- Shipping
  select sq.zone_id, sq.charge_paise into v_zone_id, v_shipping
  from private.shipping_quote(v_state, v_weight, v_merch - v_discount) sq;
  if v_zone_id is null then
    raise exception 'checkout:no_shipping' using errcode = 'P0001';
  end if;

  if v_merch - v_discount + v_shipping < 100 then
    raise exception 'checkout:minimum' using errcode = 'P0001';
  end if;

  insert into public.orders (
    user_id, email, phone, expires_at, coupon_id, coupon_code,
    subtotal_paise, discount_paise, shipping_paise, total_paise, taxable_total_paise,
    place_of_supply_code, shipping_address, billing_address, total_weight_grams, shipping_zone_id
  ) values (
    v_uid, v_email, p_phone, now() + interval '30 minutes', v_coupon_id, v_coupon_code,
    v_merch, v_discount, v_shipping, v_merch - v_discount + v_shipping, 0,
    v_state, v_address, v_address, v_weight, v_zone_id
  )
  returning id, number into v_order_id, v_number;

  -- Lines with tax.
  for i in 0 .. jsonb_array_length(v_lines) - 1 loop
    v_net := (v_lines -> i ->> 'gross')::bigint - (v_lines -> i ->> 'discount')::bigint;
    v_rate := private.gst_rate_bps(
      v_lines -> i ->> 'hsn_code', v_net, (v_lines -> i ->> 'qty')::integer, v_today, v_settings.tax_slab_basis);
    v_max_rate := greatest(v_max_rate, v_rate);
    select * into v_tax from private.gst_split(v_net, v_rate, v_intra);

    insert into public.order_items (
      order_id, variant_id, product_id, product_title, product_slug, sku, size, colour, image_key, hsn_code,
      unit_price_paise, mrp_paise, qty, line_gross_paise, line_discount_paise, line_net_paise,
      gst_rate_bps, taxable_paise, cgst_paise, sgst_paise, igst_paise
    ) values (
      v_order_id, (v_lines -> i ->> 'variant_id')::uuid, (v_lines -> i ->> 'product_id')::uuid,
      v_lines -> i ->> 'title', v_lines -> i ->> 'slug', v_lines -> i ->> 'sku', v_lines -> i ->> 'size',
      v_lines -> i ->> 'colour', v_lines -> i ->> 'image_key', v_lines -> i ->> 'hsn_code',
      (v_lines -> i ->> 'unit_price')::bigint, (v_lines -> i ->> 'mrp')::bigint, (v_lines -> i ->> 'qty')::integer,
      (v_lines -> i ->> 'gross')::bigint, (v_lines -> i ->> 'discount')::bigint, v_net,
      v_rate, v_tax.taxable, v_tax.cgst, v_tax.sgst, v_tax.igst
    );
  end loop;

  -- Shipping is one more taxable line. TODO(owner): CA to confirm shipping_tax_rate_bps; until it is
  -- set, shipping takes the highest rate in the order (composite supply follows the principal supply).
  v_ship_rate := coalesce(v_settings.shipping_tax_rate_bps, v_max_rate);
  select * into v_ship_tax from private.gst_split(v_shipping, v_ship_rate, v_intra);

  update public.orders o set
    shipping_gst_rate_bps = v_ship_rate,
    shipping_taxable_paise = v_ship_tax.taxable,
    taxable_total_paise = t.taxable + v_ship_tax.taxable,
    cgst_paise = t.cgst + v_ship_tax.cgst,
    sgst_paise = t.sgst + v_ship_tax.sgst,
    igst_paise = t.igst + v_ship_tax.igst
  from (
    select sum(oi.taxable_paise) as taxable, sum(oi.cgst_paise) as cgst,
           sum(oi.sgst_paise) as sgst, sum(oi.igst_paise) as igst
    from public.order_items oi where oi.order_id = v_order_id
  ) t
  where o.id = v_order_id;

  perform public.reserve_stock(v_order_id);

  insert into public.order_events (order_id, field, to_value, note)
  values (v_order_id, 'order_status', 'pending_payment', 'Order placed; stock reserved for 30 minutes');

  return query select o.id, o.number, o.total_paise from public.orders o where o.id = v_order_id;
end;
$$;

-- ---------------------------------------------------------------------------
-- Razorpay order bookkeeping (called as the customer from app/api/razorpay/order)
-- ---------------------------------------------------------------------------
-- The amount the Razorpay order must be created for, plus an existing Razorpay order to reuse.
create or replace function public.order_payment_target(p_order_id uuid)
returns table (order_number text, total_paise bigint, email text, phone text, razorpay_order_id text)
language plpgsql
stable
security definer
set search_path = ''
as $$
#variable_conflict use_column
begin
  if not exists (
    select 1 from public.orders o
    where o.id = p_order_id and o.user_id = (select auth.uid())
      and o.order_status = 'pending_payment' and o.expires_at > now()
  ) then
    raise exception 'order not payable' using errcode = 'P0002';
  end if;

  return query
  select o.number, o.total_paise, o.email, o.phone,
    (select p.razorpay_order_id from public.payments p
      where p.order_id = o.id and p.status <> 'captured' and p.amount_paise = o.total_paise
      order by p.created_at desc limit 1)
  from public.orders o
  where o.id = p_order_id;
end;
$$;

create or replace function public.record_razorpay_order(p_order_id uuid, p_razorpay_order_id text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if p_razorpay_order_id !~ '^order_[A-Za-z0-9]{6,40}$' then
    raise exception 'invalid razorpay order id' using errcode = '22023';
  end if;

  insert into public.payments (order_id, razorpay_order_id, amount_paise)
  select o.id, p_razorpay_order_id, o.total_paise
  from public.orders o
  where o.id = p_order_id and o.user_id = (select auth.uid()) and o.order_status = 'pending_payment'
  on conflict (razorpay_order_id) do nothing;

  if not found and not exists (
    select 1 from public.payments p where p.razorpay_order_id = p_razorpay_order_id and p.order_id = p_order_id
  ) then
    raise exception 'order not payable' using errcode = 'P0002';
  end if;
end;
$$;

-- ---------------------------------------------------------------------------
-- Payment commit (service role, from the webhook)
-- ---------------------------------------------------------------------------
-- Shared by commit_order_payment and late_payment_commit once stock is reserved: commits stock,
-- records the coupon, confirms and pays the order, issues the invoice and clears the cart lines.
create or replace function private.finalize_paid_order(
  p_order_id uuid,
  p_razorpay_order_id text,
  p_razorpay_payment_id text,
  p_method text,
  p_raw jsonb
)
returns void
language plpgsql
set search_path = ''
as $$
declare
  v_order public.orders%rowtype;
  v_settings public.store_settings%rowtype;
  v_coupon public.coupons%rowtype;
  v_uses integer;
  v_number text;
  v_now timestamptz := now();
  v_seller_state text;
  r record;
begin
  select * into v_order from public.orders where id = p_order_id for update;

  for r in
    select oi.variant_id, oi.qty from public.order_items oi
    where oi.order_id = p_order_id order by oi.variant_id
  loop
    update public.product_variants v
    set stock = v.stock - r.qty, reserved = v.reserved - r.qty
    where v.id = r.variant_id;
  end loop;

  update public.payments set
    razorpay_payment_id = p_razorpay_payment_id, status = 'captured', method = p_method, raw = p_raw
  where razorpay_order_id = p_razorpay_order_id;

  -- Coupon redemption: only paid orders count. Locking the coupon row serialises concurrent use.
  if v_order.coupon_id is not null then
    select * into v_coupon from public.coupons where id = v_order.coupon_id for update;
    select count(*) into v_uses from public.coupon_redemptions cr
    where cr.coupon_id = v_coupon.id
      and (cr.user_id = v_order.user_id or cr.email_norm = lower(v_order.email) or cr.phone_e164 = v_order.phone);
    if (v_coupon.max_uses is not null and v_coupon.used_count >= v_coupon.max_uses)
       or (v_coupon.per_user_limit is not null and v_uses >= v_coupon.per_user_limit) then
      -- The customer has already paid the discounted price; honour it and flag it.
      update public.orders set needs_attention = true,
        attention_reason = concat_ws('; ', attention_reason, 'Coupon ' || v_coupon.code || ' over its limit at payment')
      where id = p_order_id;
    end if;
    update public.coupons set used_count = used_count + 1 where id = v_coupon.id;
    insert into public.coupon_redemptions (coupon_id, order_id, user_id, email_norm, phone_e164)
    values (v_coupon.id, p_order_id, v_order.user_id, lower(v_order.email), v_order.phone);
  end if;

  perform public.transition_order(p_order_id, 'payment_status', 'paid', 'Payment ' || p_razorpay_payment_id);
  perform public.transition_order(p_order_id, 'order_status', 'confirmed');

  -- Tax invoice, issued at capture from the frozen order figures.
  select * into v_settings from public.store_settings where id = 1;
  select s.name into v_seller_state from public.indian_states s where s.code = v_settings.state_code;
  v_number := public.next_document_number('invoice', v_now);

  insert into public.invoices (
    order_id, number, issued_at, fiscal_year, seller_snapshot, buyer_snapshot, place_of_supply_code, totals, lines
  )
  select
    o.id, v_number, v_now, private.fiscal_year(v_now),
    jsonb_build_object(
      'legal_name', v_settings.legal_name, 'trade_name', v_settings.trade_name, 'gstin', v_settings.gstin,
      'address_line1', v_settings.address_line1, 'address_line2', v_settings.address_line2,
      'city', v_settings.city, 'state', v_seller_state, 'state_code', v_settings.state_code,
      'pincode', v_settings.pincode, 'email', v_settings.support_email, 'phone', v_settings.support_phone
    ),
    jsonb_build_object('email', o.email, 'phone', o.phone, 'billing_address', o.billing_address,
      'shipping_address', o.shipping_address),
    o.place_of_supply_code,
    jsonb_build_object(
      'subtotal_paise', o.subtotal_paise, 'discount_paise', o.discount_paise, 'shipping_paise', o.shipping_paise,
      'total_paise', o.total_paise, 'taxable_total_paise', o.taxable_total_paise,
      'cgst_paise', o.cgst_paise, 'sgst_paise', o.sgst_paise, 'igst_paise', o.igst_paise,
      'coupon_code', o.coupon_code
    ),
    (
      select jsonb_agg(x.l order by x.ord)
      from (
        select 0 as ord, jsonb_build_object(
          'description', oi.product_title || ' (' || oi.colour || ', ' || oi.size || ')',
          'sku', oi.sku, 'hsn_code', oi.hsn_code, 'qty', oi.qty, 'unit_price_paise', oi.unit_price_paise,
          'discount_paise', oi.line_discount_paise, 'taxable_paise', oi.taxable_paise,
          'gst_rate_bps', oi.gst_rate_bps, 'cgst_paise', oi.cgst_paise, 'sgst_paise', oi.sgst_paise,
          'igst_paise', oi.igst_paise, 'total_paise', oi.line_net_paise
        ) as l
        from public.order_items oi where oi.order_id = o.id
        union all
        select 1, jsonb_build_object(
          -- TODO(owner): CA to confirm the SAC code for shipping charges.
          'description', 'Shipping charges', 'sku', null, 'hsn_code', '996812', 'qty', 1,
          'unit_price_paise', o.shipping_paise, 'discount_paise', 0, 'taxable_paise', o.shipping_taxable_paise,
          'gst_rate_bps', o.shipping_gst_rate_bps,
          'cgst_paise', case when o.place_of_supply_code = v_settings.state_code
            then (o.shipping_paise - o.shipping_taxable_paise) / 2 else 0 end,
          'sgst_paise', case when o.place_of_supply_code = v_settings.state_code
            then (o.shipping_paise - o.shipping_taxable_paise) - (o.shipping_paise - o.shipping_taxable_paise) / 2
            else 0 end,
          'igst_paise', case when o.place_of_supply_code <> v_settings.state_code
            then o.shipping_paise - o.shipping_taxable_paise else 0 end,
          'total_paise', o.shipping_paise
        )
        where o.shipping_paise > 0
      ) x(ord, l)
    )
  from public.orders o
  where o.id = p_order_id;

  -- The ordered lines leave the cart; anything added since stays.
  delete from public.cart_items ci
  using public.carts c
  where ci.cart_id = c.id and c.user_id = v_order.user_id
    and ci.variant_id in (select oi.variant_id from public.order_items oi where oi.order_id = p_order_id);
end;
$$;

-- Returns 'committed', or 'already_paid' when this payment was processed before. Raises
-- 'payment:not_pending' (use late_payment_commit) or 'payment:amount_mismatch'.
create or replace function public.commit_order_payment(
  p_order_id uuid,
  p_razorpay_order_id text,
  p_razorpay_payment_id text,
  p_amount_paise bigint,
  p_method text default null,
  p_raw jsonb default null
)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_order public.orders%rowtype;
begin
  select * into v_order from public.orders where id = p_order_id for update;
  if not found then
    raise exception 'order not found' using errcode = 'P0002';
  end if;
  if exists (select 1 from public.payments p
             where p.order_id = p_order_id and p.razorpay_payment_id = p_razorpay_payment_id
               and p.status = 'captured') then
    return 'already_paid';
  end if;
  if not exists (select 1 from public.payments p
                 where p.order_id = p_order_id and p.razorpay_order_id = p_razorpay_order_id) then
    raise exception 'payment:order_mismatch' using errcode = 'P0001';
  end if;
  if p_amount_paise <> v_order.total_paise then
    raise exception 'payment:amount_mismatch' using errcode = 'P0001';
  end if;
  if v_order.order_status <> 'pending_payment' then
    raise exception 'payment:not_pending' using errcode = 'P0001';
  end if;

  perform private.finalize_paid_order(p_order_id, p_razorpay_order_id, p_razorpay_payment_id, p_method, p_raw);
  return 'committed';
end;
$$;

-- payment.captured for an expired order. Returns true when the order could be confirmed; false
-- when stock is gone (the order is flagged and the caller refunds in full, no credit note).
create or replace function public.late_payment_commit(
  p_order_id uuid,
  p_razorpay_order_id text,
  p_razorpay_payment_id text,
  p_amount_paise bigint,
  p_method text default null,
  p_raw jsonb default null
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_order public.orders%rowtype;
begin
  select * into v_order from public.orders where id = p_order_id for update;
  if not found then
    raise exception 'order not found' using errcode = 'P0002';
  end if;
  if v_order.order_status <> 'expired' then
    raise exception 'payment:not_expired' using errcode = 'P0001';
  end if;
  if p_amount_paise <> v_order.total_paise then
    raise exception 'payment:amount_mismatch' using errcode = 'P0001';
  end if;

  begin
    perform public.reserve_stock(p_order_id);
  exception when sqlstate 'P0001' then
    update public.payments set
      razorpay_payment_id = p_razorpay_payment_id, status = 'captured', method = p_method, raw = p_raw
    where razorpay_order_id = p_razorpay_order_id;
    update public.orders set needs_attention = true,
      attention_reason = concat_ws('; ', attention_reason, 'Late payment, stock no longer available: auto-refund')
    where id = p_order_id;
    perform public.transition_order(p_order_id, 'payment_status', 'paid', 'Late payment ' || p_razorpay_payment_id);
    return false;
  end;

  perform private.finalize_paid_order(p_order_id, p_razorpay_order_id, p_razorpay_payment_id, p_method, p_raw);
  return true;
end;
$$;

-- Records the automatic full refund of a late payment that couldn't be fulfilled.
create or replace function public.record_auto_refund(
  p_order_id uuid,
  p_razorpay_payment_id text,
  p_razorpay_refund_id text,
  p_amount_paise bigint,
  p_status text
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.refunds (order_id, payment_id, razorpay_refund_id, amount_paise, reason, status)
  select p_order_id, p.id, p_razorpay_refund_id, p_amount_paise,
    'Late payment; stock no longer available', p_status
  from public.payments p
  where p.razorpay_payment_id = p_razorpay_payment_id
  on conflict (razorpay_refund_id) do nothing;

  if (select payment_status from public.orders where id = p_order_id) = 'paid' then
    perform public.transition_order(p_order_id, 'payment_status', 'refunded', 'Automatic full refund');
  end if;
end;
$$;

-- payment.failed. A later success for the same order still commits (failed -> paid).
create or replace function public.mark_payment_failed(
  p_order_id uuid,
  p_razorpay_order_id text,
  p_razorpay_payment_id text,
  p_raw jsonb default null
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_status text;
begin
  select payment_status into v_status from public.orders where id = p_order_id for update;
  if not found then
    raise exception 'order not found' using errcode = 'P0002';
  end if;

  update public.payments set status = 'failed', razorpay_payment_id = coalesce(razorpay_payment_id, p_razorpay_payment_id),
    raw = p_raw
  where razorpay_order_id = p_razorpay_order_id and status = 'created';

  if v_status = 'unpaid' then
    perform public.transition_order(p_order_id, 'payment_status', 'failed', 'Payment ' || p_razorpay_payment_id || ' failed');
  end if;
end;
$$;

-- ---------------------------------------------------------------------------
-- Expiry (pg_cron, every minute)
-- ---------------------------------------------------------------------------
create or replace function public.expire_pending_orders()
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_order_id uuid;
  v_count integer := 0;
begin
  for v_order_id in
    select o.id from public.orders o
    where o.order_status = 'pending_payment' and o.expires_at < now()
    order by o.expires_at
    for update skip locked
  loop
    perform private.release_stock(v_order_id);
    perform public.transition_order(v_order_id, 'order_status', 'expired', 'Payment window closed; stock released');
    v_count := v_count + 1;
  end loop;
  return v_count;
end;
$$;

select cron.schedule('expire-pending-orders', '* * * * *', $$select public.expire_pending_orders()$$);

-- ---------------------------------------------------------------------------
-- Guest merge and stale guest cleanup now know about orders
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

  -- Orders and coupon redemptions move to the account.
  update public.orders set user_id = p_user_id where user_id = p_anon_uid;
  update public.coupon_redemptions set user_id = p_user_id where user_id = p_anon_uid;

  delete from auth.users where id = p_anon_uid;
end;
$$;

revoke all on function public.merge_guest_into_user(uuid, uuid) from public, anon, authenticated;
grant execute on function public.merge_guest_into_user(uuid, uuid) to service_role;

create or replace function private.delete_stale_anonymous_users()
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_count integer;
begin
  delete from auth.users u
  where u.is_anonymous and u.created_at < now() - interval '30 days'
    and not exists (select 1 from public.orders o where o.user_id = u.id);
  get diagnostics v_count = row_count;
  return v_count;
end;
$$;

-- ---------------------------------------------------------------------------
-- Function privileges
-- ---------------------------------------------------------------------------
revoke all on function private.fiscal_year(timestamptz) from public;
revoke all on function private.gst_rate_bps(text, bigint, integer, date, text) from public;
revoke all on function private.gst_split(bigint, integer, boolean) from public;
revoke all on function private.shipping_quote(text, integer, bigint) from public;
revoke all on function private.coupon_discount(text, uuid, text, text, bigint, uuid) from public;
revoke all on function private.release_stock(uuid) from public;
revoke all on function private.finalize_paid_order(uuid, text, text, text, jsonb) from public;
revoke all on function private.reject_update() from public;

-- Customer-callable (they check auth.uid() themselves).
revoke all on function public.create_order_from_cart(jsonb, text, text, text) from public, anon;
grant execute on function public.create_order_from_cart(jsonb, text, text, text) to authenticated;
revoke all on function public.coupon_for_checkout(text, text, text) from public, anon;
grant execute on function public.coupon_for_checkout(text, text, text) to authenticated;
revoke all on function public.order_payment_target(uuid) from public, anon;
grant execute on function public.order_payment_target(uuid) to authenticated;
revoke all on function public.record_razorpay_order(uuid, text) from public, anon;
grant execute on function public.record_razorpay_order(uuid, text) to authenticated;

-- Service role only (webhook, cron, admin Server Actions).
revoke all on function public.next_document_number(text, timestamptz) from public, anon, authenticated;
revoke all on function public.transition_order(uuid, text, text, text, uuid) from public, anon, authenticated;
revoke all on function public.reserve_stock(uuid) from public, anon, authenticated;
revoke all on function public.commit_order_payment(uuid, text, text, bigint, text, jsonb) from public, anon, authenticated;
revoke all on function public.late_payment_commit(uuid, text, text, bigint, text, jsonb) from public, anon, authenticated;
revoke all on function public.record_auto_refund(uuid, text, text, bigint, text) from public, anon, authenticated;
revoke all on function public.mark_payment_failed(uuid, text, text, jsonb) from public, anon, authenticated;
revoke all on function public.expire_pending_orders() from public, anon, authenticated;
grant execute on function public.next_document_number(text, timestamptz) to service_role;
grant execute on function public.transition_order(uuid, text, text, text, uuid) to service_role;
grant execute on function public.reserve_stock(uuid) to service_role;
grant execute on function public.commit_order_payment(uuid, text, text, bigint, text, jsonb) to service_role;
grant execute on function public.late_payment_commit(uuid, text, text, bigint, text, jsonb) to service_role;
grant execute on function public.record_auto_refund(uuid, text, text, bigint, text) to service_role;
grant execute on function public.mark_payment_failed(uuid, text, text, jsonb) to service_role;
grant execute on function public.expire_pending_orders() to service_role;
