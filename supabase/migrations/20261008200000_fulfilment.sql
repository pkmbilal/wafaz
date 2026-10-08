-- M8 admin orders and fulfilment: shipments, credit notes, refund details, and the DB functions
-- behind the admin order actions (ship, deliver, RTO, cancel, refund).
-- See docs/DATA_MODEL.md §2 (Shipping, Tax documents, Orders and payments), §4 and §5.

-- ---------------------------------------------------------------------------
-- shipments
-- ---------------------------------------------------------------------------
create table public.shipments (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null unique references public.orders (id) on delete restrict,
  courier text not null check (courier in ('dtdc', 'india_post', 'other')),
  tracking_number text not null check (tracking_number ~ '^[A-Za-z0-9-]{3,40}$'),
  shipped_at timestamptz not null default now(),
  delivered_at timestamptz,
  rto_at timestamptz,
  rto_received_at timestamptz,
  created_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index shipments_created_by_idx on public.shipments (created_by);

create trigger shipments_set_updated_at
  before update on public.shipments
  for each row execute function private.set_updated_at();

-- ---------------------------------------------------------------------------
-- refunds: what each refund covers
-- ---------------------------------------------------------------------------
-- 'initiated' = recorded in the DB, Razorpay not yet confirmed; only one per order at a time.
alter table public.refunds drop constraint refunds_status_check;
alter table public.refunds
  add constraint refunds_status_check check (status in ('initiated', 'pending', 'processed', 'failed')),
  -- 'auto' = late-payment refund with no invoice (no credit note).
  add column kind text not null default 'auto' check (kind in ('auto', 'partial', 'cancel', 'rto')),
  -- [{order_item_id, qty}]
  add column items jsonb not null default '[]'::jsonb check (jsonb_typeof(items) = 'array'),
  add column include_shipping boolean not null default false,
  -- The credit-note figures, computed when the refund is prepared (refund_lines()).
  add column credit_lines jsonb,
  add column credit_totals jsonb,
  add column error text check (char_length(error) <= 1000);

create index refunds_initiated_idx on public.refunds (created_at) where status = 'initiated';

-- ---------------------------------------------------------------------------
-- credit_notes (immutable)
-- ---------------------------------------------------------------------------
create table public.credit_notes (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders (id) on delete restrict,
  invoice_id uuid not null references public.invoices (id) on delete restrict,
  refund_id uuid not null unique references public.refunds (id) on delete restrict,
  number text not null unique check (char_length(number) <= 16),
  issued_at timestamptz not null default now(),
  fiscal_year text not null,
  reason text not null check (char_length(reason) <= 500),
  totals jsonb not null,
  lines jsonb not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index credit_notes_order_id_idx on public.credit_notes (order_id);
create index credit_notes_invoice_id_idx on public.credit_notes (invoice_id);

create trigger credit_notes_immutable
  before update or delete on public.credit_notes
  for each row execute function private.reject_update();

-- ---------------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------------
alter table public.shipments enable row level security;
alter table public.credit_notes enable row level security;

create policy "shipments: read own or admin" on public.shipments for select to authenticated
  using (
    exists (select 1 from public.orders o where o.id = order_id and o.user_id = (select auth.uid()))
    or (select private.is_admin())
  );

create policy "credit_notes: read own or admin" on public.credit_notes for select to authenticated
  using (
    exists (select 1 from public.orders o where o.id = order_id and o.user_id = (select auth.uid()))
    or (select private.is_admin())
  );

revoke all on public.shipments, public.credit_notes from anon;
revoke insert, update, delete on public.shipments, public.credit_notes from authenticated;

-- ---------------------------------------------------------------------------
-- Helpers
-- ---------------------------------------------------------------------------
-- Round-half-up share of x for k of n units.
create or replace function private.share_half_up(p_x bigint, p_k integer, p_n integer)
returns bigint
language sql
immutable
set search_path = ''
as $$
  select (2 * p_x * p_k + p_n) / (2 * p_n);
$$;

-- Stock back on the shelf (cancellation, RTO). p_items: [{order_item_id, qty}].
create or replace function private.restock_order_items(p_order_id uuid, p_items jsonb)
returns void
language plpgsql
set search_path = ''
as $$
declare
  r record;
begin
  for r in
    select oi.variant_id, sum((i->>'qty')::integer) as qty
    from jsonb_array_elements(p_items) i
    join public.order_items oi on oi.id = (i->>'order_item_id')::uuid and oi.order_id = p_order_id
    group by oi.variant_id
    order by oi.variant_id
  loop
    update public.product_variants v set stock = v.stock + r.qty where v.id = r.variant_id;
  end loop;
end;
$$;

-- Credit-note figures for refunding p_items (+ shipping), taken from the frozen order lines.
-- Each figure is prorated cumulatively: the share for units [r, r+q) of n is
-- round(x·(r+q)/n) − round(x·r/n), so refunds of a line always add up to exactly the line.
-- Returns {amount_paise, items, lines, totals, full}. Raises refund:* on invalid input.
create or replace function private.refund_lines(p_order_id uuid, p_items jsonb, p_include_shipping boolean)
returns jsonb
language plpgsql
stable
set search_path = ''
as $$
declare
  v_order public.orders%rowtype;
  v_invoice public.invoices%rowtype;
  v_intra boolean;
  v_lines jsonb := '[]'::jsonb;
  v_items jsonb := '[]'::jsonb;
  v_total bigint := 0;
  v_taxable bigint := 0;
  v_cgst bigint := 0;
  v_sgst bigint := 0;
  v_igst bigint := 0;
  v_items_total bigint := 0;
  v_ship_tax bigint;
  v_line_total bigint;
  v_cgst_l bigint;
  v_sgst_l bigint;
  v_igst_l bigint;
  v_remaining integer;
  v_shipping_refunded boolean;
  r record;
begin
  select * into v_order from public.orders where id = p_order_id;
  if not found then
    raise exception 'refund:order_not_found' using errcode = 'P0002';
  end if;
  if v_order.payment_status not in ('paid', 'partially_refunded') then
    raise exception 'refund:not_refundable' using errcode = '22023';
  end if;
  select * into v_invoice from public.invoices where order_id = p_order_id;
  if not found then
    raise exception 'refund:no_invoice' using errcode = '22023';
  end if;
  v_intra := v_invoice.place_of_supply_code = v_invoice.seller_snapshot->>'state_code';

  if jsonb_typeof(p_items) is distinct from 'array' then
    raise exception 'refund:invalid_items' using errcode = '22023';
  end if;
  if exists (
    select 1 from jsonb_array_elements(p_items) i
    where jsonb_typeof(i->'qty') is distinct from 'number' or (i->>'qty')::numeric <= 0
      or (i->>'qty')::numeric <> trunc((i->>'qty')::numeric)
      or not exists (
        select 1 from public.order_items oi
        where oi.order_id = p_order_id and oi.id::text = i->>'order_item_id'
      )
  ) then
    raise exception 'refund:invalid_items' using errcode = '22023';
  end if;

  for r in
    select oi.*, q.qty as refund_qty
    from (
      select (i->>'order_item_id')::uuid as id, sum((i->>'qty')::integer)::integer as qty
      from jsonb_array_elements(p_items) i
      group by 1
    ) q
    join public.order_items oi on oi.id = q.id
    order by oi.product_title, oi.id
  loop
    if r.refund_qty > r.qty - r.refunded_qty then
      raise exception 'refund:qty_exceeds_remaining' using errcode = '22023';
    end if;

    v_line_total := private.share_half_up(r.line_net_paise, r.refunded_qty + r.refund_qty, r.qty)
      - private.share_half_up(r.line_net_paise, r.refunded_qty, r.qty);
    v_cgst_l := private.share_half_up(r.cgst_paise, r.refunded_qty + r.refund_qty, r.qty)
      - private.share_half_up(r.cgst_paise, r.refunded_qty, r.qty);
    v_sgst_l := private.share_half_up(r.sgst_paise, r.refunded_qty + r.refund_qty, r.qty)
      - private.share_half_up(r.sgst_paise, r.refunded_qty, r.qty);
    v_igst_l := private.share_half_up(r.igst_paise, r.refunded_qty + r.refund_qty, r.qty)
      - private.share_half_up(r.igst_paise, r.refunded_qty, r.qty);

    v_lines := v_lines || jsonb_build_object(
      'order_item_id', r.id,
      'description', r.product_title || ' (' || r.colour || ', ' || r.size || ')',
      'sku', r.sku, 'hsn_code', r.hsn_code, 'qty', r.refund_qty, 'unit_price_paise', r.unit_price_paise,
      'discount_paise', r.unit_price_paise * r.refund_qty - v_line_total,
      'taxable_paise', v_line_total - v_cgst_l - v_sgst_l - v_igst_l,
      'gst_rate_bps', r.gst_rate_bps,
      'cgst_paise', v_cgst_l, 'sgst_paise', v_sgst_l, 'igst_paise', v_igst_l,
      'total_paise', v_line_total
    );
    v_items := v_items || jsonb_build_object('order_item_id', r.id, 'qty', r.refund_qty);
    v_items_total := v_items_total + v_line_total;
    v_total := v_total + v_line_total;
    v_taxable := v_taxable + v_line_total - v_cgst_l - v_sgst_l - v_igst_l;
    v_cgst := v_cgst + v_cgst_l;
    v_sgst := v_sgst + v_sgst_l;
    v_igst := v_igst + v_igst_l;
  end loop;

  -- Units still unrefunded once this refund goes through.
  select coalesce(sum(oi.qty - oi.refunded_qty - coalesce(q.qty, 0)), 0) into v_remaining
  from public.order_items oi
  left join (
    select (i->>'order_item_id')::uuid as id, sum((i->>'qty')::integer)::integer as qty
    from jsonb_array_elements(p_items) i group by 1
  ) q on q.id = oi.id
  where oi.order_id = p_order_id;

  select exists (
    select 1 from public.refunds rf
    where rf.order_id = p_order_id and rf.include_shipping and rf.status <> 'failed'
  ) into v_shipping_refunded;

  if p_include_shipping and v_order.shipping_paise > 0 then
    if v_shipping_refunded then
      raise exception 'refund:shipping_already_refunded' using errcode = '22023';
    end if;
    -- Shipping is refunded only with the last of the items (it isn't divisible).
    if v_remaining > 0 then
      raise exception 'refund:shipping_needs_full_refund' using errcode = '22023';
    end if;
    v_ship_tax := v_order.shipping_paise - v_order.shipping_taxable_paise;
    v_lines := v_lines || jsonb_build_object(
      'order_item_id', null,
      'description', 'Shipping charges', 'sku', null, 'hsn_code', '996812', 'qty', 1,
      'unit_price_paise', v_order.shipping_paise, 'discount_paise', 0,
      'taxable_paise', v_order.shipping_taxable_paise, 'gst_rate_bps', v_order.shipping_gst_rate_bps,
      'cgst_paise', case when v_intra then v_ship_tax / 2 else 0 end,
      'sgst_paise', case when v_intra then v_ship_tax - v_ship_tax / 2 else 0 end,
      'igst_paise', case when v_intra then 0 else v_ship_tax end,
      'total_paise', v_order.shipping_paise
    );
    v_total := v_total + v_order.shipping_paise;
    v_taxable := v_taxable + v_order.shipping_taxable_paise;
    v_cgst := v_cgst + case when v_intra then v_ship_tax / 2 else 0 end;
    v_sgst := v_sgst + case when v_intra then v_ship_tax - v_ship_tax / 2 else 0 end;
    v_igst := v_igst + case when v_intra then 0 else v_ship_tax end;
    v_shipping_refunded := true;
  end if;

  if v_total <= 0 then
    raise exception 'refund:nothing_to_refund' using errcode = '22023';
  end if;

  return jsonb_build_object(
    'amount_paise', v_total,
    'items', v_items,
    'lines', v_lines,
    'totals', jsonb_build_object(
      'items_paise', v_items_total, 'shipping_paise', v_total - v_items_total, 'total_paise', v_total,
      'taxable_total_paise', v_taxable, 'cgst_paise', v_cgst, 'sgst_paise', v_sgst, 'igst_paise', v_igst
    ),
    'full', v_remaining = 0 and (v_shipping_refunded or v_order.shipping_paise = 0)
  );
end;
$$;

-- ---------------------------------------------------------------------------
-- Fulfilment
-- ---------------------------------------------------------------------------
-- Ship an unfulfilled or packed order (passing through 'packed').
create or replace function public.ship_order(
  p_order_id uuid,
  p_courier text,
  p_tracking_number text,
  p_actor_id uuid
)
returns void
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
  if v_order.payment_status not in ('paid', 'partially_refunded') then
    raise exception 'ship:not_paid' using errcode = '22023';
  end if;
  if exists (select 1 from public.refunds where order_id = p_order_id and status = 'initiated') then
    raise exception 'refund:in_progress' using errcode = '22023';
  end if;
  if v_order.fulfillment_status = 'unfulfilled' then
    perform public.transition_order(p_order_id, 'fulfillment_status', 'packed', null, p_actor_id);
  end if;
  perform public.transition_order(
    p_order_id, 'fulfillment_status', 'shipped',
    'Shipped via ' || p_courier || ', tracking ' || p_tracking_number, p_actor_id
  );
  insert into public.shipments (order_id, courier, tracking_number, created_by)
  values (p_order_id, p_courier, p_tracking_number, p_actor_id);
end;
$$;

create or replace function public.mark_order_delivered(p_order_id uuid, p_actor_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform 1 from public.orders where id = p_order_id for update;
  perform public.transition_order(p_order_id, 'fulfillment_status', 'delivered', null, p_actor_id);
  update public.shipments set delivered_at = now() where order_id = p_order_id;
  perform public.transition_order(p_order_id, 'order_status', 'completed', null, p_actor_id);
end;
$$;

-- The parcel is coming back. Stock and the refund wait for receipt (prepare_refund kind 'rto').
create or replace function public.mark_order_rto(p_order_id uuid, p_actor_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform 1 from public.orders where id = p_order_id for update;
  perform public.transition_order(p_order_id, 'fulfillment_status', 'returned_to_origin', null, p_actor_id);
  update public.shipments set rto_at = now() where order_id = p_order_id;
end;
$$;

-- Clears the "Needs attention" flag and logs who resolved it and how.
create or replace function public.resolve_attention(p_order_id uuid, p_note text, p_actor_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_reason text;
begin
  select attention_reason into v_reason from public.orders where id = p_order_id and needs_attention for update;
  if not found then
    raise exception 'attention:not_flagged' using errcode = '22023';
  end if;
  update public.orders set needs_attention = false, attention_reason = null where id = p_order_id;
  perform public.transition_order(
    p_order_id, 'note', null,
    left('Resolved: ' || coalesce(v_reason, '') || ' — ' || p_note, 1000), p_actor_id
  );
end;
$$;

-- ---------------------------------------------------------------------------
-- Refunds (AGENTS.md §5.2, §5.5). The Server Action calls prepare_refund, then the Razorpay Refunds
-- API, then complete_refund (or fail_refund). The credit-note number is only taken in
-- complete_refund, after Razorpay accepted the refund, so a failed refund never burns a number.
-- ---------------------------------------------------------------------------
create or replace function public.refund_preview(p_order_id uuid, p_items jsonb, p_include_shipping boolean)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select private.refund_lines(p_order_id, p_items, p_include_shipping);
$$;

-- p_kind: 'partial' (chosen items, no restock), 'cancel' (everything left, before shipping; restocks
-- and cancels), 'rto' (everything left once the returned parcel is received; restocks and cancels).
-- For cancel and rto, p_items is ignored.
create or replace function public.prepare_refund(
  p_order_id uuid,
  p_kind text,
  p_items jsonb,
  p_include_shipping boolean,
  p_reason text,
  p_actor_id uuid
)
returns table (refund_id uuid, amount_paise bigint, razorpay_payment_id text, order_number text)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_order public.orders%rowtype;
  v_payment public.payments%rowtype;
  v_items jsonb := p_items;
  v_include_shipping boolean := p_include_shipping;
  v_calc jsonb;
  v_id uuid;
begin
  select * into v_order from public.orders where id = p_order_id for update;
  if not found then
    raise exception 'refund:order_not_found' using errcode = 'P0002';
  end if;
  if exists (select 1 from public.refunds r where r.order_id = p_order_id and r.status = 'initiated') then
    raise exception 'refund:in_progress' using errcode = '22023';
  end if;
  if p_reason is null or char_length(btrim(p_reason)) = 0 or char_length(p_reason) > 500 then
    raise exception 'refund:invalid_reason' using errcode = '22023';
  end if;

  if p_kind = 'cancel' then
    if v_order.order_status <> 'confirmed' or v_order.fulfillment_status not in ('unfulfilled', 'packed') then
      raise exception 'refund:cannot_cancel' using errcode = '22023';
    end if;
  elsif p_kind = 'rto' then
    if v_order.order_status <> 'confirmed' or v_order.fulfillment_status <> 'returned_to_origin' then
      raise exception 'refund:not_rto' using errcode = '22023';
    end if;
  elsif p_kind = 'partial' then
    if v_order.order_status not in ('confirmed', 'completed') then
      raise exception 'refund:not_refundable' using errcode = '22023';
    end if;
  else
    raise exception 'refund:invalid_kind' using errcode = '22023';
  end if;

  if p_kind in ('cancel', 'rto') then
    select coalesce(jsonb_agg(jsonb_build_object('order_item_id', oi.id, 'qty', oi.qty - oi.refunded_qty)), '[]'::jsonb)
    into v_items
    from public.order_items oi
    where oi.order_id = p_order_id and oi.qty > oi.refunded_qty;
    -- A cancelled order refunds shipping too (unless it already went back).
    if p_kind = 'cancel' then
      v_include_shipping := not exists (
        select 1 from public.refunds r
        where r.order_id = p_order_id and r.include_shipping and r.status <> 'failed'
      );
    end if;
  end if;

  v_calc := private.refund_lines(p_order_id, v_items, v_include_shipping);

  select * into v_payment from public.payments p
  where p.order_id = p_order_id and p.status = 'captured'
  order by p.created_at desc limit 1;
  if not found then
    raise exception 'refund:no_payment' using errcode = '22023';
  end if;

  insert into public.refunds (
    order_id, payment_id, amount_paise, reason, status, created_by, kind, items, include_shipping,
    credit_lines, credit_totals
  )
  values (
    p_order_id, v_payment.id, (v_calc->>'amount_paise')::bigint, btrim(p_reason), 'initiated', p_actor_id,
    p_kind, v_calc->'items', v_include_shipping and v_order.shipping_paise > 0,
    v_calc->'lines', v_calc->'totals'
  )
  returning id into v_id;

  return query select v_id, (v_calc->>'amount_paise')::bigint, v_payment.razorpay_payment_id, v_order.number;
end;
$$;

-- Razorpay accepted the refund: issue the credit note and apply its effects. Idempotent for the
-- same Razorpay refund id (the webhook can recover a refund whose Server Action died midway).
-- Returns the credit note number.
create or replace function public.complete_refund(
  p_refund_id uuid,
  p_razorpay_refund_id text,
  p_status text
)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_refund public.refunds%rowtype;
  v_order public.orders%rowtype;
  v_invoice_id uuid;
  v_number text;
  v_now timestamptz := now();
  v_refunded bigint;
begin
  if p_status not in ('pending', 'processed') then
    raise exception 'refund:invalid_status' using errcode = '22023';
  end if;
  select * into v_order from public.orders
  where id = (select r.order_id from public.refunds r where r.id = p_refund_id)
  for update;
  select * into v_refund from public.refunds where id = p_refund_id for update;
  if not found then
    raise exception 'refund:not_found' using errcode = 'P0002';
  end if;

  if v_refund.status <> 'initiated' then
    if v_refund.razorpay_refund_id = p_razorpay_refund_id then
      return (select cn.number from public.credit_notes cn where cn.refund_id = p_refund_id);
    end if;
    raise exception 'refund:not_initiated' using errcode = '22023';
  end if;

  update public.refunds set razorpay_refund_id = p_razorpay_refund_id, status = p_status
  where id = p_refund_id;

  update public.order_items oi set refunded_qty = oi.refunded_qty + (i->>'qty')::integer
  from jsonb_array_elements(v_refund.items) i
  where oi.id = (i->>'order_item_id')::uuid and oi.order_id = v_order.id;

  if v_refund.kind in ('cancel', 'rto') then
    perform private.restock_order_items(v_order.id, v_refund.items);
  end if;

  select id into v_invoice_id from public.invoices where order_id = v_order.id;
  v_number := public.next_document_number('credit_note', v_now);
  insert into public.credit_notes (order_id, invoice_id, refund_id, number, issued_at, fiscal_year, reason, totals, lines)
  values (
    v_order.id, v_invoice_id, p_refund_id, v_number, v_now, private.fiscal_year(v_now), v_refund.reason,
    v_refund.credit_totals, v_refund.credit_lines
  );

  select coalesce(sum(r.amount_paise), 0) into v_refunded
  from public.refunds r
  where r.order_id = v_order.id and r.status in ('pending', 'processed') and r.kind <> 'auto';

  if v_refunded >= v_order.total_paise then
    perform public.transition_order(v_order.id, 'payment_status', 'refunded',
      'Refund ' || p_razorpay_refund_id || ', credit note ' || v_number, v_refund.created_by);
  elsif v_order.payment_status = 'paid' then
    perform public.transition_order(v_order.id, 'payment_status', 'partially_refunded',
      'Refund ' || p_razorpay_refund_id || ', credit note ' || v_number, v_refund.created_by);
  else
    perform public.transition_order(v_order.id, 'note', null,
      'Refund ' || p_razorpay_refund_id || ', credit note ' || v_number, v_refund.created_by);
  end if;

  if v_refund.kind = 'rto' then
    update public.shipments set rto_received_at = v_now where order_id = v_order.id;
  end if;
  if v_refund.kind in ('cancel', 'rto') then
    perform public.transition_order(v_order.id, 'order_status', 'cancelled',
      case v_refund.kind when 'rto' then 'Returned parcel received' else v_refund.reason end,
      v_refund.created_by);
  end if;

  return v_number;
end;
$$;

-- Razorpay rejected the refund before it was accepted: nothing changes except the refund row,
-- and the order is flagged.
create or replace function public.fail_refund(p_refund_id uuid, p_error text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_order_id uuid;
begin
  update public.refunds set status = 'failed', error = left(p_error, 1000)
  where id = p_refund_id and status = 'initiated'
  returning order_id into v_order_id;
  if v_order_id is null then
    raise exception 'refund:not_initiated' using errcode = '22023';
  end if;
  update public.orders set needs_attention = true,
    attention_reason = left(concat_ws('; ', attention_reason, 'Refund failed: ' || left(p_error, 200)), 500)
  where id = v_order_id;
end;
$$;

-- Razorpay webhook refund.processed / refund.failed for a refund already accepted. A refund that
-- fails after its credit note was issued is flagged for the owner to retry or settle manually.
-- Returns the order id, or null if the refund isn't ours.
create or replace function public.record_refund_status(p_razorpay_refund_id text, p_status text)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_refund public.refunds%rowtype;
begin
  if p_status not in ('processed', 'failed') then
    raise exception 'refund:invalid_status' using errcode = '22023';
  end if;
  select * into v_refund from public.refunds where razorpay_refund_id = p_razorpay_refund_id for update;
  if not found then
    return null;
  end if;
  if v_refund.status = p_status or v_refund.status = 'failed' then
    return v_refund.order_id;
  end if;
  update public.refunds set status = p_status where id = v_refund.id;
  if p_status = 'failed' then
    update public.orders set needs_attention = true,
      attention_reason = left(concat_ws('; ', attention_reason,
        'Razorpay refund ' || p_razorpay_refund_id || ' failed after it was accepted'), 500)
    where id = v_refund.order_id;
  end if;
  return v_refund.order_id;
end;
$$;

-- ---------------------------------------------------------------------------
-- Admin dashboard reads (RLS-scoped; admins only)
-- ---------------------------------------------------------------------------
-- Active variants at or below store_settings.low_stock_threshold available units.
create or replace function public.admin_low_stock()
returns table (
  variant_id uuid, product_id uuid, product_title text, sku text, size text, colour text, available integer
)
language sql
stable
security invoker
set search_path = ''
as $$
  select v.id, p.id, p.title, v.sku, v.size, v.colour, v.stock - v.reserved
  from public.product_variants v
  join public.products p on p.id = v.product_id
  cross join public.store_settings s
  where (select private.is_admin())
    and s.id = 1
    and v.is_active and p.status = 'active'
    and v.stock - v.reserved <= s.low_stock_threshold
  order by v.stock - v.reserved, p.title, v.sku
  limit 50;
$$;

-- ---------------------------------------------------------------------------
-- Grants
-- ---------------------------------------------------------------------------
revoke all on function private.share_half_up(bigint, integer, integer) from public;
revoke all on function private.restock_order_items(uuid, jsonb) from public;
revoke all on function private.refund_lines(uuid, jsonb, boolean) from public;

-- Service role only (admin Server Actions, after the role check; webhook).
revoke all on function public.ship_order(uuid, text, text, uuid) from public, anon, authenticated;
revoke all on function public.mark_order_delivered(uuid, uuid) from public, anon, authenticated;
revoke all on function public.mark_order_rto(uuid, uuid) from public, anon, authenticated;
revoke all on function public.resolve_attention(uuid, text, uuid) from public, anon, authenticated;
revoke all on function public.refund_preview(uuid, jsonb, boolean) from public, anon, authenticated;
revoke all on function public.prepare_refund(uuid, text, jsonb, boolean, text, uuid) from public, anon, authenticated;
revoke all on function public.complete_refund(uuid, text, text) from public, anon, authenticated;
revoke all on function public.fail_refund(uuid, text) from public, anon, authenticated;
revoke all on function public.record_refund_status(text, text) from public, anon, authenticated;
grant execute on function public.ship_order(uuid, text, text, uuid) to service_role;
grant execute on function public.mark_order_delivered(uuid, uuid) to service_role;
grant execute on function public.mark_order_rto(uuid, uuid) to service_role;
grant execute on function public.resolve_attention(uuid, text, uuid) to service_role;
grant execute on function public.refund_preview(uuid, jsonb, boolean) to service_role;
grant execute on function public.prepare_refund(uuid, text, jsonb, boolean, text, uuid) to service_role;
grant execute on function public.complete_refund(uuid, text, text) to service_role;
grant execute on function public.fail_refund(uuid, text) to service_role;
grant execute on function public.record_refund_status(text, text) to service_role;

revoke all on function public.admin_low_stock() from public, anon;
grant execute on function public.admin_low_stock() to authenticated;
