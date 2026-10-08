# DATA_MODEL — Phase 1 Schema

This is the source of truth for the Phase 1 schema. Add tables for later phases only when that phase starts.

## 1. Conventions (every table)

- **Primary keys:** `id uuid primary key default gen_random_uuid()`
- **Timestamps:** `created_at timestamptz not null default now()` and `updated_at timestamptz not null default now()`, kept current by the shared trigger `set_updated_at()`
- **Money:** `bigint` paise, with `check (col >= 0)`. Columns end in `_paise`.
- **Enums:** use `text` columns with `check (col in (...))` rather than Postgres enum types, which are easier to extend later.
- **Foreign keys:** declared explicitly and **indexed**. Use `on delete restrict` unless noted otherwise.
- **Deletion:** catalog rows are archived via `status`, never hard-deleted once referenced. Orders, invoices, credit notes, payments and events are **never** deleted. On orders and order items the **money, tax and snapshot columns** are frozen once the order is created; only the status columns, `needs_attention`/`attention_reason` and `refunded_qty` change, and only through DB functions. Invoices and credit notes are never updated.
- **RLS:** enabled on every table, with policies written explicitly in the same migration.
- **Unique constraints:** slugs, SKUs, coupon codes (`check (code = upper(code))` + `unique (code)`) and document numbers.
- **Timezone:** business dates (financial year, invoice date, "today" on the dashboard) are computed in `Asia/Kolkata`, never in UTC.

## 2. Tables

### Settings and reference
```
store_settings (singleton: id = 1)
  legal_name, trade_name, gstin, address_line1, address_line2, city, state, state_code ('32'),
  pincode, support_email, support_phone,
  grievance_officer_name, grievance_officer_email, grievance_officer_phone,
  invoice_prefix ('INV'), credit_note_prefix ('CN'),
    -- check (char_length(prefix) <= 5) so 'PFX/26-27/00001' stays <= 16 chars
  tax_slab_basis ('inclusive' | 'taxable')   -- CA decides
  shipping_tax_rate_bps int,                  -- CA decides
  low_stock_threshold int default 3,          -- dashboard "low stock" panel
  new_badge_days int default 30,              -- product card NEW badge: products.published_at within N days
  einvoice_enabled bool default false

indian_states (code text pk, name)            -- seeded: GST state codes

tax_slabs
  id, hsn_code, min_unit_paise, max_unit_paise (null = no max), rate_bps,
  effective_from date, effective_to date null
  -- range is min_unit_paise < value <= max_unit_paise (GST wording is "not exceeding");
  --   the lowest slab uses min_unit_paise = 0 and includes 0
  -- no overlaps: exclude using gist (hsn_code with =, int8range(min,max,'(]') with &&,
  --   daterange(effective_from, effective_to, '[)') with &&)   -- needs btree_gist
  -- rate lookup uses the slab active on the ORDER date (orders.created_at in IST)
```

### Users
```
profiles (id = auth.users.id, on delete cascade)
  full_name, phone (E.164, nullable), email (nullable),
  role ('customer' | 'staff' | 'owner') default 'customer',
  marketing_consent bool default false, marketing_consent_at,
  deletion_requested_at null
  -- row created by an AFTER INSERT trigger on auth.users (covers anonymous users too)
  -- customers cannot change role: column-level grants (grant update (full_name, phone,
  --   email, marketing_consent, marketing_consent_at, deletion_requested_at) to authenticated)
  --   plus a BEFORE UPDATE trigger rejecting role changes unless the caller is owner

addresses
  user_id → profiles, name, phone, line1, line2, city, state_code → indian_states,
  pincode (check ~ '^\d{6}$'), is_default
```

### Catalog
```
categories     parent_id null → categories, name, slug unique, image_key, sort_order, is_active
products       category_id, title, slug unique, description, fabric, style, occasion, care,
               hsn_code, country_of_origin default 'India', size_chart_id null,
               status ('draft' | 'active' | 'archived'), published_at null, seo_title, seo_description,
               search tsvector   -- GIN index; pg_trgm GIN index on title
               -- NOT a generated column (those can't read product_tags). Maintained by
               -- refresh_product_search(product_id), called from triggers on products
               -- and product_tags, using to_tsvector('simple', title || fabric || tag names)
product_variants
               product_id, sku unique, size, colour, colour_hex,
               mrp_paise, price_paise (check price_paise <= mrp_paise),
               weight_grams int (check > 0),
               stock int, reserved int,
               check (stock >= 0 and reserved >= 0 and reserved <= stock),
               is_active, unique (product_id, size, colour)
product_media  product_id, colour null, r2_key, alt, sort_order, kind ('image')
tags           name, slug unique
product_tags   product_id, tag_id (pk both)
collections    title, slug unique, description, kind ('manual'), image_key, is_active
collection_products  collection_id, product_id, sort_order (pk collection_id + product_id)
size_charts    name, data jsonb
banners        title, image_key, link, placement, sort_order, starts_at, ends_at, is_active
pages          slug unique, title, body, seo_title, seo_description, is_published
```

### Cart
```
carts       user_id unique → auth.users on delete cascade (includes anonymous users)
cart_items  cart_id, variant_id, qty (check qty between 1 and 10), unique (cart_id, variant_id)
```

### Coupons
```
coupons
  code (stored uppercase, unique), kind ('percent' | 'flat'), value,
  max_discount_paise null, min_cart_paise, max_uses null, per_user_limit null,
  first_order_only bool, used_count int default 0, starts_at, ends_at, is_active
coupon_redemptions
  coupon_id, order_id unique, user_id, email_norm, phone_e164, created_at
  -- inserted only inside commit_order_payment()
  -- per_user_limit and first_order_only count matches on user_id OR email_norm
  --   (lower(trim(email))) OR phone_e164, so a fresh anonymous session can't bypass them
  -- "first order" = no paid order exists for that user_id, email or phone
```

Coupons discount only the merchandise subtotal, never shipping. A flat coupon is clamped to the subtotal.

### Orders and payments
```
orders
  number text unique                  -- 'ORD-' || lpad(seq, 6, '0'); a plain sequence is fine here (gaps allowed)
  user_id → auth.users, email, phone,
  order_status       ('pending_payment' | 'confirmed' | 'cancelled' | 'expired' | 'completed')
  payment_status     ('unpaid' | 'paid' | 'partially_refunded' | 'refunded' | 'failed')
  fulfillment_status ('unfulfilled' | 'packed' | 'shipped' | 'delivered' | 'returned_to_origin')
  expires_at timestamptz              -- reservation deadline while pending_payment
  needs_attention bool default false, attention_reason text null
  coupon_id null, coupon_code null,
  subtotal_paise, discount_paise, shipping_paise, total_paise,   -- all GST-inclusive
    -- check (total_paise >= 100): Razorpay can't take a zero amount
  taxable_total_paise, cgst_paise, sgst_paise, igst_paise,   -- include the shipping line
  shipping_gst_rate_bps, shipping_taxable_paise,
  place_of_supply_code → indian_states,
  shipping_address jsonb (snapshot), billing_address jsonb (snapshot),
  total_weight_grams, shipping_zone_id

order_items (immutable snapshot)
  order_id, variant_id, product_id, product_title, product_slug, sku, size, colour, image_key, hsn_code,
  unit_price_paise, mrp_paise, qty, line_gross_paise, line_discount_paise, line_net_paise,
  gst_rate_bps, taxable_paise, cgst_paise, sgst_paise, igst_paise,
  refunded_qty int default 0

order_events
  order_id, field ('order_status' | 'payment_status' | 'fulfillment_status' | 'note'),
  from_value, to_value, note, actor_id null (null = system), created_at

payments
  order_id, razorpay_order_id unique, razorpay_payment_id unique null,
  status ('created' | 'captured' | 'failed'), amount_paise, method, raw jsonb

refunds
  order_id, payment_id, razorpay_refund_id unique null, amount_paise,
  reason, status ('initiated' | 'pending' | 'processed' | 'failed'), created_by null (null = system),
  kind ('auto' | 'partial' | 'cancel' | 'rto'),   -- 'auto' = late-payment refund, no credit note
  items jsonb [{order_item_id, qty}], include_shipping bool,
  credit_lines jsonb, credit_totals jsonb,         -- credit-note figures fixed by prepare_refund
  error text null
  -- 'initiated' = recorded, Razorpay not yet confirmed; at most one per order at a time
  -- the credit note points at the refund (credit_notes.refund_id), not the other way round

webhook_events
  provider ('razorpay'), event_id unique, event_type, payload jsonb,
  status ('received' | 'processed' | 'failed'), error text null, attempts int, processed_at

auth_hook_events
  channel ('whatsapp'), recipient_hash text,   -- sha256 of the E.164 number, no raw PII
  status ('sent' | 'failed' | 'dry_run'), error text null, provider_message_id null
  -- written by app/api/auth/send-otp; failures in the last 24 h feed "Needs attention"
```

### Tax documents (immutable)
```
document_sequences
  doc_type ('invoice' | 'credit_note'), fiscal_year ('26-27'), last_value int,
  pk (doc_type, fiscal_year)

invoices
  order_id unique, number unique,            -- e.g. 'INV/26-27/00001' (max 16 chars)
  issued_at, fiscal_year,
  seller_snapshot jsonb (from store_settings), buyer_snapshot jsonb,
  place_of_supply_code, totals jsonb, lines jsonb   -- frozen copy used for the PDF

credit_notes
  order_id, invoice_id, refund_id unique, number unique,   -- 'CN/26-27/00001'
  issued_at, fiscal_year, reason, totals jsonb, lines jsonb  -- immutable, like invoices
```

### Shipping
```
shipping_zones
  name, state_codes text[], base_paise, base_weight_grams default 500,
  per_additional_500g_paise, free_above_paise null, is_active
shipments
  order_id unique, courier ('dtdc' | 'india_post' | 'other'), tracking_number,
  shipped_at, delivered_at null, rto_at null, rto_received_at null, created_by
```

### Infrastructure
```
rate_limits   key text, window_start timestamptz, count int, pk (key, window_start)
              -- pg_cron deletes rows older than 1 day
email_events  order_id null, kind ('order_confirmed' | 'late_payment_refunded' | 'order_shipped' |
              'order_delivered' | 'order_cancelled' | 'order_refunded' | 'admin_needs_attention'),
              dedupe_key text unique,      -- e.g. 'order_confirmed:<order id>', also Resend's idempotency key
              recipient_hash text,         -- sha256 of the address, no raw PII
              status ('pending' | 'sent' | 'failed' | 'dry_run'), attempts, error null, provider_message_id null
              -- one row per logical email so webhook retries never double-send; failures in the
              -- last 24 h feed "Needs attention"
```

## 3. RLS Summary

| Table group | Customer (incl. anonymous) | Staff | Owner |
|---|---|---|---|
| Catalog, pages, banners | read active / published rows | read/write | read/write |
| `tax_slabs`, `indian_states`, `shipping_zones` | read active rows | read/write (TODO(owner): should tax slabs and shipping zones be owner-only?) | read/write |
| `profiles` | own row (cannot change `role`) | read | read/write |
| `addresses`, `carts`, `cart_items` | own rows | read | read |
| `orders`, `order_items`, `invoices`, `credit_notes`, `shipments` | read own | read + status actions via functions | all |
| `payments`, `refunds`, `webhook_events`, `auth_hook_events`, `email_events`, `coupon_redemptions`, `document_sequences`, `rate_limits` | none | read (no `webhook_events`, `auth_hook_events`) | read |
| `coupons` | none (validated server-side) | read | read/write |
| `store_settings` | read public fields via view `public_store_settings` | read | read/write |

Customers never write directly to orders, payments or documents. All writes go through `security definer` functions called from the server.

## 4. Status Machines

`transition_order(order_id, field, to_value, note, actor_id)` enforces these transitions and logs every change to `order_events`.

**order_status**
- `pending_payment` → `confirmed` (payment captured) | `expired` (cron) | `cancelled` (customer, before payment)
- `expired` → `confirmed` (only via `late_payment_commit`)
- `confirmed` → `cancelled` (admin; requires a full refund; only while fulfillment is `unfulfilled` or `packed`) | `completed` (when fulfillment is `delivered`)
- `confirmed` → `cancelled` also happens after RTO, once receipt is confirmed and the full refund is issued. TODO(owner): confirm RTO orders should end as `cancelled` (vs. a separate `returned` status).

**payment_status**
- `unpaid` → `paid` | `failed`
- `failed` → `paid` (retry succeeded)
- `paid` → `partially_refunded` | `refunded`
- `partially_refunded` → `refunded`

**fulfillment_status** (only when `order_status = 'confirmed'`)
- `unfulfilled` → `packed` → `shipped` → `delivered`
- `shipped` → `returned_to_origin` (restocks when admin confirms receipt; triggers refund + credit note)

## 5. DB Functions (security definer, transactional)

- **`reserve_stock(order_id)`**
  - Locks variant rows `FOR UPDATE` in a consistent order (by `variant_id`) to avoid deadlocks.
  - Fails the whole order if any line has `stock - reserved < qty`.
- **`create_order_from_cart(user_id, address, coupon_code, …)`**
  - Recalculates prices, discount allocation, shipping and GST.
  - Inserts the order and items, calls `reserve_stock`, sets `expires_at`.
  - Returns the order.
- **`commit_order_payment(order_id, razorpay_payment_id, amount_paise)`**
  - Checks the amount, then commits stock (`stock -= qty`, `reserved -= qty`).
  - Records the coupon redemption and increments `used_count`, re-checking limits.
  - Sets the statuses, issues the invoice via `next_document_number('invoice')`, and clears the cart.
- **`expire_pending_orders()`**
  - Run by pg_cron every minute.
  - Releases reservations where `expires_at < now()` and `order_status = 'pending_payment'`.
- **`late_payment_commit(order_id, …)`**
  - Tries to reserve and commit.
  - On failure, sets `needs_attention`. The caller then issues a full automatic refund.
  - No invoice was issued for that order, so this refund has **no credit note** (the money was an advance that was returned, not a supply). TODO(owner): confirm with the CA.
- **`restock_order_items(order_id, items)`** (private)
  - Used for cancellation and RTO (`complete_refund`). Partial refunds don't restock.
- **`ship_order(order_id, courier, tracking_number, actor)`**, **`mark_order_delivered(order_id, actor)`**, **`mark_order_rto(order_id, actor)`**
  - Admin fulfilment. Shipping passes through `packed` and records the shipment; delivery also completes the order.
- **`refund_preview(order_id, items, include_shipping)`** → `private.refund_lines`
  - Credit-note figures from the frozen order lines, prorated cumulatively per unit: the share of units `[r, r+q)` of `n` is `round(x·(r+q)/n) − round(x·r/n)`, so a line's refunds always add up to the line exactly. Shipping is refunded only with the last of the items.
- **`prepare_refund(order_id, kind, items, include_shipping, reason, actor)`** → **`complete_refund(refund_id, razorpay_refund_id, status)`** / **`fail_refund(refund_id, error)`**
  - The admin Server Action calls `prepare_refund` (records an `initiated` refund with its credit-note figures), then the Razorpay Refunds API, then `complete_refund` (credit note via `next_document_number('credit_note')`, `refunded_qty`, payment status, and for `cancel`/`rto` restock + `order_status = cancelled`). A Razorpay rejection calls `fail_refund` and flags the order; no credit-note number is taken.
  - The Razorpay refund carries our refund id in its notes, so the `refund.*` webhook can finish a refund whose Server Action died after Razorpay accepted it.
- **`record_refund_status(razorpay_refund_id, status)`**
  - Webhook `refund.processed` / `refund.failed` for an accepted refund. A failure after the credit note was issued flags the order.
- **`resolve_attention(order_id, note, actor)`**
  - Clears "Needs attention" and logs the note in `order_events`.
- **`admin_low_stock()`**
  - Security invoker, admins only: active variants at or below `store_settings.low_stock_threshold` available units.
- **`admin_adjust_stock(variant_id, delta)`**
  - Security definer, admins only. Locks the variant row, adds or removes units (received stock, damage, recount) and returns the new stock. Never below `reserved`. The only way admins change stock; the column grants block direct writes.
- **`admin_save_variants(product_id, variants)`**
  - Security invoker (RLS and column grants apply), admins only. In one transaction, updates existing variants (never their stock) and inserts new ones with their opening stock.
- **`admin_set_product_tags(product_id, tag_ids)`**, **`admin_set_product_collections(product_id, collection_ids)`**
  - Security invoker, admins only. Replace the product's whole set; new collection memberships go to the end of each collection.
- **`admin_reorder_media(product_id, media_ids)`**, **`admin_set_collection_products(collection_id, product_ids)`**
  - Security invoker, admins only. The array order becomes `sort_order`; the second also replaces the collection's members.
- **`next_document_number(doc_type, issued_at)`**
  - Gets the fiscal year from `issued_at at time zone 'Asia/Kolkata'` (April–March).
  - Upserts and locks the `document_sequences` row, increments it, and returns the formatted number. This keeps numbering gapless.
- **`merge_guest_into_user(anon_uid, user_id)`**
  - Service role only. Moves the guest's addresses (the account keeps its own default) and fills an empty `full_name`, then deletes the anonymous user.
  - Merges cart lines (summing quantities, capped at 10) and reassigns the guest's orders (orders: added with the orders milestone).
- **`cart_add_item(variant_id, qty)`** / **`cart_set_qty(item_id, qty)`**
  - Security invoker (RLS applies). Get-or-create the caller's cart and upsert the line, capped at 10 and at available stock (`stock - reserved`). Adding to the cart never reserves stock. `cart_set_qty(…, 0)` removes the line.
- **`cart_lines()`**
  - Security definer, scoped to `auth.uid()`. Returns the caller's lines with product details, including lines whose variant or product is no longer sold (flagged `purchasable = false`).
- **`order_payment_target(order_id)`** / **`record_razorpay_order(order_id, rzp_order_id)`**
  - Called as the customer from `app/api/razorpay/order`. The first returns the amount to charge (the DB total) and any Razorpay order to reuse; the second records the `payments` row.
- **`mark_payment_failed(...)`**, **`record_auto_refund(...)`**
  - Webhook helpers: `payment.failed` → `payment_status = failed` (a later success still commits); the late-payment refund row (no credit note).
- **`coupon_for_checkout(code, email, phone)`**, **`checkout_tax_settings()`**
  - Read-only inputs for the checkout preview in `lib/pricing.ts` (coupon rules and this customer's usage; seller state, slab basis, shipping tax rate).
- **`check_my_rate_limit(scope, max, window_seconds)`**
  - `check_rate_limit` keyed to `auth.uid()`, for signed-in callers (order create, coupon apply). `check_rate_limit` itself is service-role only.
- **`set_default_address(address_id)`**
  - Security invoker (RLS applies). Clears the caller's other defaults and sets this one.
- **`transition_order(...)`**
  - See §4.
- **`check_rate_limit(key, max, window_seconds)`**
  - Returns a boolean.
- **`refresh_product_search(product_id)`**
  - Rebuilds `products.search`. Called by triggers on `products` and `product_tags`.

Profiles mirror verified contact details: an `AFTER UPDATE OF phone, email` trigger on `auth.users` copies them to `profiles` (a guest who upgrades via `updateUser` keeps their uid).

**pg_cron jobs:** `expire_pending_orders()` every minute, `rate_limits` cleanup daily, and stale anonymous user cleanup daily (anonymous users older than 30 days with no orders).

## 6. GST Calculation (`lib/gst/` mirrors it for display; the DB result is authoritative)

For each order:

1. **Allocate the discount.** `line_gross = unit_price × qty`. Split the order discount across lines in proportion to `line_gross`, and give any rounding remainder to the largest line. Then `line_net = line_gross − line_discount`.
2. **Find the per-piece value.** `unit_net = line_net / qty`, kept as an exact fraction (compare `line_net` against `bound × qty` rather than rounding).
3. **Look up the rate.** Find `rate_bps` in `tax_slabs` using `hsn_code`, `unit_net` and the order date (`orders.created_at` in IST).
   - If `tax_slab_basis = 'taxable'`, test the slab against `unit_net × 10000 / (10000 + rate_bps)`.
   - Check each candidate slab and pick the one whose range (`min < value <= max`) contains the tested value.
   - If no slab matches, or more than one does, raise an error and do not create the order.
4. **Back-calculate tax** from the inclusive price:
   - `taxable = round(line_net × 10000 / (10000 + rate_bps))`
   - `tax = line_net − taxable`
5. **Split the tax.**
   - If `place_of_supply_code = store_settings.state_code`: `cgst = floor(tax / 2)`, `sgst = tax − cgst`.
   - Otherwise: `igst = tax`.
6. **Shipping.** Treat shipping as one extra taxable line at `store_settings.shipping_tax_rate_bps`, using the same steps.
7. **Order totals** are the sums of the line values. `total_paise = Σ line_net + shipping`.

**Invoice PDF must show:**
- seller legal name, address and GSTIN
- invoice number and date
- buyer name and address
- place of supply (state name + code)
- per line: description, HSN, qty, unit price, discount, taxable value, rate, CGST/SGST or IGST amount, total
- grand total in figures and words
- "Tax is payable on reverse charge: No"
- "Authorised signatory" line with the seller's legal name (CGST Rule 46)

**Credit notes** use the same layout for the refunded lines and reference the original invoice number.
