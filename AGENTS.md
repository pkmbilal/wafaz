<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

# AGENTS.md — Fashion E-Store (Indian Ethnic Wear)

> **CURRENT PHASE: 1**
> Build only features marked for the current phase in `docs/ROADMAP.md`.

This file holds the standing rules for any coding agent working in this repo. Read it fully before writing code.

| Doc | Contents |
|---|---|
| `AGENTS.md` (this file) | Stack, commands, conventions, non-negotiable rules |
| `docs/ROADMAP.md` | Features per phase |
| `docs/DATA_MODEL.md` | Schema, constraints, DB functions, status machines |

**Conflict and ambiguity rule**
- If a task conflicts with a rule in these docs, **stop and ask**. Do not work around the rule.
- If a requirement has a small gap (copy, layout detail, an edge case not covered), implement the simplest reasonable version and leave a `TODO(owner): <question>` comment.
- Never pull in a feature from a later phase "while you're there".

---

## 1. Project Overview

An online store for Indian ethnic wear (kurtis, kurti sets, co-ords, kaftans, etc.). Reference site for features and UX: vismay.com.

- **Seller:** GST-registered business in **Kerala** (state code `32`)
- **Customers:** India only, prices in INR, **prepaid only via Razorpay**. There is **no Cash on Delivery**; do not build COD, COD flags, or COD fields.
- **Shipping:** the owner books parcels with DTDC or India Post manually and enters the tracking number in admin
- **Login:** WhatsApp OTP or email OTP only. No SMS, no passwords, no social login.

## 2. Tech Stack

| Layer | Choice |
|---|---|
| Framework | Next.js, App Router, TypeScript. Pin the exact version in `package.json` |
| Styling | Tailwind CSS v4 + shadcn/ui (restyled to the brand, see §6) |
| Database | Supabase Postgres + RLS + pg_cron + pg_trgm |
| Auth | Supabase Auth: anonymous sign-ins (guests), phone OTP sent over **WhatsApp** via Send SMS Hook, email OTP |
| Media | Cloudflare R2: one public bucket for media, one private bucket for anything with personal data |
| Payments | Razorpay Standard Checkout |
| WhatsApp | Meta WhatsApp Cloud API (OTP authentication template in Phase 1) |
| Email | Resend (also used as Supabase Auth custom SMTP) + React Email |
| PDFs | `@react-pdf/renderer` (invoices, credit notes, packing slips, labels) |
| Validation / forms | Zod, react-hook-form |
| Bot protection | Cloudflare Turnstile (Supabase Auth captcha + checkout) |
| Errors | Sentry |
| Tests | Vitest (unit + DB integration), Playwright (end-to-end) |
| Hosting | Vercel **Pro** + Supabase **Pro** for production. Free tiers are for dev only. Vercel Hobby forbids commercial use. |

**Approved runtime dependencies:** `@supabase/supabase-js`, `@supabase/ssr`, `razorpay`, `@aws-sdk/client-s3`, `@aws-sdk/s3-request-presigner`, `zod`, `react-hook-form`, `@hookform/resolvers`, `@react-pdf/renderer`, `resend`, `@react-email/components`, `standardwebhooks`, `@sentry/nextjs`, `lucide-react`, plus what shadcn installs.

Ask before adding anything else.

## 3. Commands

```bash
pnpm install
pnpm dev
pnpm build              # must pass before any PR
pnpm lint
pnpm typecheck          # tsc --noEmit
pnpm test               # vitest (unit + DB integration)
pnpm test:e2e           # playwright, against local stack + Razorpay test mode
supabase start
supabase db reset       # reapply migrations + seed
supabase gen types typescript --local > types/database.ts
```

After any schema change, regenerate the types and commit the migration and the types together.

## 4. Folder Structure

There is no `src/` directory. The `@/*` import alias maps to the project root (`"@/*": ["./*"]`).

```
app/
  (store)/
    page.tsx                  # home
    collections/[slug]/
    products/[slug]/
    search/
    cart/
    checkout/
    orders/[id]/              # order view (owner session OR signed token link)
    account/                  # profile, orders, addresses
    login/
    pages/[slug]/             # policies, about, contact, grievance officer
  admin/                      # role-protected, noindex, always dynamic
    dev/components/           # component showcase (dev only)
  api/
    razorpay/order/           # create Razorpay order
    razorpay/webhook/         # Razorpay webhook
    auth/send-otp/            # Supabase Send SMS Hook → WhatsApp OTP
    r2/presign/               # presigned uploads (admin only)
    invoices/[id]/            # PDF on demand (auth checked)
components/
  ui/                         # shadcn components, restyled
  store/
  admin/
lib/
  supabase/                   # server, browser, admin (service role) clients
  razorpay.ts
  whatsapp.ts                 # Meta Cloud API client
  r2.ts
  pricing.ts                  # cart totals + discount allocation (single source of truth)
  gst/                        # tax calc, state codes, invoice numbering helpers
  shipping/                   # zones, weight calc, courier tracking URLs (dtdc.ts, indiapost.ts)
  rate-limit.ts               # wraps DB function check_rate_limit()
  validators/                 # zod schemas
  cache-tags.ts               # all revalidateTag names in one place
emails/
pdf/                          # react-pdf templates
types/
tests/
  unit/
  db/
  e2e/
  fixtures/razorpay/          # sample webhook payloads
supabase/
  migrations/
  seed.sql
docs/
```

## 5. Non-Negotiable Rules

### 5.1 Money
- All money is integer **paise** (`bigint`), never floats. Convert to rupees only for display.
- **All prices are GST-inclusive** (Indian retail/MRP convention). Tax is back-calculated from prices, never added on top.
- The server recalculates every total from the DB. Never trust client-sent prices, discounts or totals.
- Cart and discount maths live only in `lib/pricing.ts`; tax maths only in `lib/gst/`. Never duplicate either.
- Rounding: compute per line in paise, round half-up, and show the order-level total as the sum of the lines.

### 5.2 GST and invoices (seller is GST-registered)
Full rules are in `docs/DATA_MODEL.md` §6. In summary:
- **Discount allocation:** discounts are allocated across line items in proportion to their value before tax is calculated.
- **Rate lookup:** the GST rate is taken from `tax_slabs` by HSN code and per-piece value after discount. Never hardcode rates. Whether the slab threshold is tested on the tax-inclusive or taxable value is the setting `store_settings.tax_slab_basis`, which the owner's CA decides.
- **Tax type:** the place of supply is the shipping address state. Kerala (`32`) → CGST + SGST, split equally. Any other state → IGST.
- **Invoice numbers:** a tax invoice is issued when payment is captured. Numbers are **gapless and sequential per financial year** (April–March), at most 16 characters, e.g. `INV/26-27/00001`. They come from `next_document_number()`, never from a Postgres sequence, because sequences can skip numbers.
- **Refunds:** every refund or return against an invoiced order issues a **credit note** with its own gapless series (`CN/26-27/00001`). Invoices are never edited. Exception: the automatic refund of a late payment that couldn't be fulfilled has no invoice, so it has no credit note (see `docs/DATA_MODEL.md` §5).
- **Dates:** the financial year and invoice date are computed in `Asia/Kolkata`.
- **Immutability:** the tax and price figures stored on an order are final. PDFs are rendered on demand from them.
- **Seller details:** the seller's legal name, GSTIN, address and state code come from `store_settings`, never from env vars or hardcoded values.
- E-invoicing (IRN) is out of scope; it isn't mandatory below the turnover threshold. Keep `store_settings.einvoice_enabled = false`.

### 5.3 Auth
- **Guests:**
  - A visitor without a session gets a Supabase **anonymous sign-in** (Turnstile captcha enabled) **lazily, on their first cart action** (add to cart, open cart, checkout), so carts and guest orders are protected by normal RLS using `auth.uid()`. Catalog pages never create sessions, so they stay cacheable and bots don't create users.
  - Stale anonymous users (older than 30 days, no orders) are deleted by a daily cron.
  - Guests can check out. Email and phone are collected at checkout.
- **WhatsApp OTP:**
  - The app calls `signInWithOtp({ phone })`. Supabase calls the **Send SMS Hook** at `app/api/auth/send-otp`.
  - The hook verifies the Standard Webhooks signature, then sends the OTP through the approved Meta **authentication template** (copy-code button).
  - No SMS provider is configured, so no DLT registration is needed.
  - If the WhatsApp send fails, the UI offers email OTP instead.
- **Email OTP:**
  - `signInWithOtp({ email })` with the email template showing the 6-digit `{{ .Token }}` (codes, not magic links).
  - Verify with `verifyOtp`. SMTP is Resend.
- **Phone format:** numbers are stored as E.164 (`+91XXXXXXXXXX`) and validated as Indian mobile numbers.
- **Upgrading a guest:**
  - New phone or email → `updateUser({ phone | email })` plus OTP. The `uid` stays the same, so nothing needs merging.
  - Phone or email already belongs to an account → capture the anonymous `uid` server-side, sign in to the existing account, then call `merge_guest_into_user(anon_uid)` (service role). This moves the cart and orders.
- **Dev mode:** with `WHATSAPP_DRY_RUN=true` (dev only), the hook logs the OTP to the server console instead of sending it.

### 5.4 Payments (Razorpay)
1. Create the Razorpay order server-side only, with the amount taken from the DB order total. Auto-capture must be enabled in the Razorpay dashboard (the flow relies on `payment.captured`).
2. Open Checkout with `timeout: 900` (15 minutes). This is shorter than the 30-minute stock reservation.
3. On checkout success, verify `HMAC_SHA256(order_id + "|" + payment_id, KEY_SECRET)`, then show a "confirming payment" state.
4. **The webhook is the source of truth.** In the handler:
   - Read the **raw body** with `await req.text()` and verify `X-Razorpay-Signature` *before* parsing the JSON.
   - Use the `x-razorpay-event-id` header as the idempotency key in `webhook_events`.
   - Check that the payment amount and `razorpay_order_id` match the DB order. On a mismatch, flag the order and do not fulfil it.
   - Store the event, process it in a single DB transaction, and return 200. On failure, record the error on the event row and return 500 so Razorpay retries.
5. **Late payments:** if `payment.captured` arrives for an order that already expired, call `late_payment_commit()`. If the stock can be re-reserved, confirm the order. If not, refund in full automatically, add the order to the admin "Needs attention" list, and email the customer.
6. Never log or expose `RAZORPAY_KEY_SECRET` or `RAZORPAY_WEBHOOK_SECRET`.

### 5.5 Inventory
Available stock = `stock - reserved`. **All stock changes happen only in DB functions** (see `docs/DATA_MODEL.md` §5), never read-then-write in app code.

| Event | Effect |
|---|---|
| Order created (`pending_payment`, `expires_at = now() + 30 min`) | `reserved += qty` |
| `payment.captured` | `stock -= qty`, `reserved -= qty`, order `confirmed`, invoice issued |
| Expiry (pg_cron, every minute) or `payment.failed` with no later success | `reserved -= qty`, order `expired` |
| Admin cancels a paid order | `stock += qty`, full refund, credit note |
| Parcel returned to origin (RTO) | `stock += qty` once admin confirms receipt |

### 5.6 Order state
An order has **three separate statuses**: `order_status`, `payment_status` and `fulfillment_status`. The allowed transitions are in `docs/DATA_MODEL.md` §4. Every change goes through `transition_order()`, which validates it and writes to `order_events`.

### 5.7 Coupons
- Validate the coupon in `lib/pricing.ts` at checkout. Check: active window, minimum cart value, global limit, `per_user_limit`, and `first_order_only`.
- Codes are stored uppercase and unique case-insensitively.
- Redemption is recorded and `used_count` is incremented **inside the payment-commit DB function**, so only paid orders count and concurrent use can't over-redeem.

### 5.8 Security
- **RLS:** enabled on **every** table. Customers access only their own rows.
- **Admin:** checked via `profiles.role in ('owner','staff')` in RLS and in route guards.
- **Service role:** the key is used only in `lib/supabase/admin.ts`, and only from webhooks, the auth hook, cron-triggered routes, admin Server Actions, OTP request rate limiting in the login Server Action (`check_rate_limit()`, before a session exists), the guest-merge step of login (`merge_guest_into_user`), and guest order / invoice reads **after** the `?t=` HMAC token has been verified (those reads are scoped to that one order ID). Never import it into client code.
- **Rate limits:** apply `check_rate_limit()`:

  | Action | Limit |
  |---|---|
  | OTP requests | 5 per phone/email per hour, 20 per IP per hour |
  | Coupon apply | 10 per session per 10 min |
  | Order create | 5 per user per 10 min |

  Supabase Auth's built-in limits stay on as well.
- **Turnstile:** required on anonymous sign-in, OTP request and order creation.
- **Coupon limits** (`per_user_limit`, `first_order_only`) match on user ID, normalised email **or** phone, so a new guest session can't reuse a coupon.
- **Guest order links:** `/orders/[id]?t=<token>` where the token is an HMAC of the order ID and email using `ORDER_LINK_SECRET`. Links never expire but grant read-only access.
- **Uploads:** R2 presigned URLs are admin-only and expire after 5 minutes. Keys are generated server-side. Content types are limited to jpeg, png, webp and avif, with a maximum of 10 MB.

### 5.9 Media and private files
- **Public bucket** (`R2_PUBLIC_BUCKET`, behind a custom domain): product, category and banner images only. Keys look like `products/{product_id}/{uuid}.{ext}`.
- **Private bucket** (`R2_PRIVATE_BUCKET`): anything containing personal data. Invoices, credit notes, slips and labels are **not stored**; they are rendered on demand from the DB snapshot after an auth check.
- The DB stores keys only. URLs are built in `lib/r2.ts`.
- Images go through `next/image` with a custom Cloudflare Image Resizing loader. Watch the monthly transformation quota and use a fixed set of widths (`[320, 480, 768, 1080, 1440]`).

### 5.10 Caching
- **Catalog pages** (home, collections, products, search, pages): cached and tagged using the names in `lib/cache-tags.ts` (`catalog`, `product:{id}`, `collection:{slug}`, `page:{slug}`, `settings`). Every admin mutation calls `revalidateTag` for the tags it affects.
- **Always dynamic, never cached:** cart, checkout, login, account, orders and `admin/`.
- Cached pages may show a price that is a few seconds out of date. That's acceptable because checkout always recalculates.
- `admin/`, `account/`, `checkout/` and `orders/` are `noindex` and excluded in `robots.txt`.
- Use only the caching APIs documented for the pinned Next.js version. Don't mix in patterns from older versions.

### 5.11 Code style
- TypeScript strict; avoid `any` (add a justifying comment if you must use it).
- Server Components by default.
- Validate every Server Action and route handler input with Zod.
- Use the generated Supabase types only.
- Mobile-first: most traffic will be on phones.

### 5.12 Observability
- Sentry on server and client. Strip PII (phone, email, address) in `beforeSend`.
- Every webhook and auth-hook failure is recorded in the DB and reported to Sentry.
- The admin dashboard shows a **Needs attention** panel: amount mismatches, late payments refunded automatically, failed webhooks, and failed WhatsApp OTP sends in the last 24 hours.

## 6. UI — shadcn/ui, Restyled to the Brand

shadcn is the **starting point**. Components are copied into `components/ui/` and owned by this repo. The final UI must not look like default shadcn.

- **Setup:** run `pnpm dlx shadcn@latest init` (no `src/` folder, CSS variables, Tailwind v4). Add components one at a time, only when needed.
- **Restyle before first use.** Edit the files in `components/ui/` directly; don't wrap a component just to override its styles.
- **Overwrites:** never re-run `shadcn add` on an existing component without reviewing the diff. It overwrites our changes.
- **Accessibility:** keep the Radix behaviour (focus, keyboard, ARIA) intact. Change the look, not the accessibility.
- **Variants:** brand variants go in the component's `cva` config (e.g. `variant="festive"`).
- **Tokens:** all colours, fonts, radii, shadows and spacing are CSS variables in `app/globals.css`. Never use raw hex values or one-off sizes.
- **Fonts:** load via `next/font`. One display serif for headings, one sans for body (exact fonts to be decided by the owner). Light theme only in Phase 1.
- **General UI:** touch targets at least 44×44px, respect `prefers-reduced-motion`, and use `aria-live` for cart updates and toasts.
- **Not allowed:** any other component kit (MUI, Chakra, Mantine, DaisyUI, Flowbite, HeroUI, Ant Design).
- **Showcase:** `/admin/dev/components` renders every primitive and variant (dev only).

**Phase 1 shadcn components:**

`button` `input` `input-otp` `textarea` `label` `select` `checkbox` `radio-group` `switch` `dialog` `sheet` `drawer` `sonner` `badge` `tabs` `accordion` `tooltip` `skeleton` `pagination` `breadcrumb` `slider` `dropdown-menu` `separator` `table` `form` `carousel`

**Phase 1 store components:**

`Header` `MobileMenu` `MobileBottomNav` `AnnouncementBar` (static text) `CartDrawer` `ProductCard` `ProductGallery` (switches with selected colour) `PriceTag` `SizeSelector` `ColourSwatch` `QuantityStepper` `FilterPanel` `SortMenu` `CartLineItem` `CheckoutSteps` `AddressForm` `OtpLogin` (WhatsApp / email tabs) `OrderStatusTimeline` `Footer` (with seller details) `WhatsAppButton` `EmptyState`

## 7. Environment Variables

```
NEXT_PUBLIC_SITE_URL=
ORDER_LINK_SECRET=

NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=
SUPABASE_SEND_SMS_HOOK_SECRET=        # Standard Webhooks secret for the auth hook

R2_ACCOUNT_ID=
R2_ACCESS_KEY_ID=
R2_SECRET_ACCESS_KEY=
R2_PUBLIC_BUCKET=
R2_PRIVATE_BUCKET=
NEXT_PUBLIC_MEDIA_URL=

NEXT_PUBLIC_RAZORPAY_KEY_ID=
RAZORPAY_KEY_SECRET=
RAZORPAY_WEBHOOK_SECRET=

WHATSAPP_PHONE_NUMBER_ID=
WHATSAPP_ACCESS_TOKEN=
WHATSAPP_OTP_TEMPLATE_NAME=
WHATSAPP_OTP_TEMPLATE_LANG=en
WHATSAPP_DRY_RUN=false                # true only in local dev

RESEND_API_KEY=
EMAIL_FROM=

NEXT_PUBLIC_TURNSTILE_SITE_KEY=
TURNSTILE_SECRET_KEY=

SENTRY_DSN=
NEXT_PUBLIC_SENTRY_DSN=

# Phase 3, only if courier automation is approved
DTDC_API_KEY=
DTDC_CUSTOMER_CODE=
SHIPROCKET_EMAIL=
SHIPROCKET_PASSWORD=
```

Business details (legal name, GSTIN, address, grievance officer, invoice prefixes) live in the `store_settings` table, not here. Keep `.env.example` in sync.

## 8. Testing Requirements

- **Unit (Vitest):** `lib/pricing.ts`, `lib/gst/*` (inclusive back-calculation, CGST/SGST vs IGST, slab boundaries, discount allocation, rounding) and `lib/shipping/*`. Aim for 100% branch coverage on pricing and GST.
- **DB integration** (Vitest against local Supabase):
  - `reserve_stock`, `commit_order_payment`, `expire_pending_orders`, `late_payment_commit`, `next_document_number` and `transition_order`, including concurrency tests (two buyers, last unit)
  - RLS: customer A cannot read customer B's rows; an anonymous user sees only their own
- **Webhook:** fixture payloads in `tests/fixtures/razorpay/` covering a bad signature, a duplicate event, an amount mismatch, a late payment, and a payment failure followed by success.
- **E2E (Playwright):** browse → add to cart → guest checkout → Razorpay test payment → order confirmed → invoice downloadable. Also: login via email OTP (local Inbucket) and WhatsApp OTP (dry-run log).

## 9. Definition of Done (every task)

- [ ] `pnpm build`, `lint`, `typecheck` and `test` pass; e2e passes for checkout-related changes
- [ ] New tables follow the `docs/DATA_MODEL.md` conventions (UUID, timestamps, constraints, indexes, RLS + policies)
- [ ] Migration added; types regenerated
- [ ] Inputs validated with Zod; rate limit and Turnstile applied where §5.8 requires
- [ ] Money in paise, prices GST-inclusive, totals computed server-side
- [ ] Stock and status changes go only through DB functions
- [ ] Catalog mutations revalidate the correct cache tags
- [ ] Works at 375px width and keyboard-only; uses design tokens only
- [ ] No secrets or PII in client bundles, logs or Sentry
- [ ] `.env.example` updated if env vars changed
- [ ] Short summary of what changed, plus any `TODO(owner)` items added
