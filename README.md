# Wafaz — Indian Ethnic Wear Store

Next.js (App Router) storefront and admin for a GST-registered seller in Kerala. Supabase (Postgres, Auth, pg_cron),
Razorpay prepaid checkout, WhatsApp/email OTP login, Cloudflare R2 media, Resend email, Sentry.

Rules for contributors and coding agents: [`AGENTS.md`](AGENTS.md). Features by phase: [`docs/ROADMAP.md`](docs/ROADMAP.md).
Schema, DB functions and status machines: [`docs/DATA_MODEL.md`](docs/DATA_MODEL.md).

## Local development

Prerequisites: Node 24, pnpm, Docker (for the local Supabase stack).

```bash
pnpm install
cp .env.example .env.local                  # fill in; see comments in the file
cp supabase/.env.example supabase/.env      # local auth hook + Turnstile test secret
supabase start
supabase db reset                           # migrations + seed
pnpm dev
```

Local dev uses Cloudflare's always-pass Turnstile test keys and `WHATSAPP_DRY_RUN=true`, which prints WhatsApp OTPs
to the server console. Email OTPs land in the local Mailpit inbox (`supabase status` shows its URL). Without
`RESEND_API_KEY`, order emails are logged instead of sent.

After any schema change:

```bash
supabase gen types typescript --local > types/database.ts
```

## Checks

```bash
pnpm lint
pnpm typecheck
pnpm test        # Vitest: unit + DB integration (needs `supabase start`)
pnpm build
pnpm test:e2e    # Playwright, see below
```

### End-to-end tests

`pnpm test:e2e` starts its own `next dev` against the **local** Supabase stack (never the hosted project), on the
port the local Send SMS Hook calls (`SUPABASE_SEND_SMS_HOOK_URI`, usually 3000). Stop your own dev server first.
The first run needs `pnpm exec playwright install chromium`.

- **Login:** email OTP (read from Mailpit) and WhatsApp OTP (read from the dry-run log in `.e2e/server.log`).
- **Checkout:** needs Razorpay **test** keys (`rzp_test_…`) in `.env.local` or the shell; it is skipped without them
  and refuses live keys. The server creates a real test-mode Razorpay order. The browser's Checkout widget is stubbed:
  it delivers a signed `payment.captured` webhook (the source of truth) and returns a signed success response. Then
  the test checks the order is confirmed and the invoice PDF downloads.

## Deploying (production)

Hosting is Vercel **Pro** + Supabase **Pro** (Hobby forbids commercial use).

1. **Supabase:** apply all migrations in `supabase/migrations/` (do not run `seed.sql` sample products in production;
   seed only tax slabs, shipping zones, states and settings rows). Enable backups or PITR. Confirm the pg_cron jobs
   `expire-pending-orders`, `stale-anonymous-users-cleanup` and `rate-limits-cleanup` are active.
2. **Supabase Auth:**
   - Site URL and redirect URLs set to the production domain.
   - Anonymous sign-ins on, with Turnstile captcha (production secret).
   - Email OTP template shows `{{ .Token }}`.
   - Custom SMTP is Resend.
   - Send SMS Hook points at `https://<domain>/api/auth/send-otp` with its secret.
3. **Vercel env:** every variable in `.env.example`, with production values.
   - `WHATSAPP_DRY_RUN=false`.
   - A random `ORDER_LINK_SECRET` of at least 32 characters.
   - `SENTRY_ORG`, `SENTRY_PROJECT` and `SENTRY_AUTH_TOKEN` for source maps.
4. **Razorpay:** live keys after KYC. Auto-capture on. Webhook at `https://<domain>/api/razorpay/webhook` for
   `payment.captured`, `payment.failed`, `refund.processed` and `refund.failed`, with `RAZORPAY_WEBHOOK_SECRET`.
5. **WhatsApp (Meta Cloud API):** verified business, approved OTP authentication template, permanent access token.
6. **Resend:** sending domain verified (SPF, DKIM, DMARC). `EMAIL_FROM` uses that domain.
7. **Cloudflare:**
   - R2 public bucket on a custom domain (`NEXT_PUBLIC_MEDIA_URL`), plus a private bucket.
   - CORS rule on the public bucket allowing `PUT` from the site origin.
   - Image Resizing enabled.
   - Turnstile widget for the production hostname.
8. **Store data (admin → Settings):**
   - Legal name, GSTIN, address and grievance officer.
   - Tax slab basis and shipping tax rate, confirmed by the CA.
   - Final text for every policy page.
   - Real products in place of the samples.
   - An owner account: set `profiles.role = 'owner'` for the owner's user.
