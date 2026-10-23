# Wafaz — Indian Ethnic Wear Store

Next.js (App Router) storefront and admin for a GST-registered seller in Kerala. Supabase (Postgres, Auth, pg_cron),
Razorpay prepaid checkout, email + password login, Cloudflare R2 media, Resend email, Sentry.

Rules for contributors and coding agents: [`AGENTS.md`](AGENTS.md). Features by phase: [`docs/ROADMAP.md`](docs/ROADMAP.md).
Schema, DB functions and status machines: [`docs/DATA_MODEL.md`](docs/DATA_MODEL.md).

## Local development

Prerequisites: Node 24, pnpm, Docker (for the local Supabase stack).

```bash
pnpm install
cp .env.example .env.local                  # fill in; see comments in the file
cp supabase/.env.example supabase/.env      # Turnstile test secret for the local stack
supabase start
supabase db reset                           # migrations + seed
pnpm dev
```

Local dev uses Cloudflare's always-pass Turnstile test keys. Sign-up and password reset codes land in the local
Mailpit inbox (`supabase status` shows its URL). Without
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
port 3000 (override with `E2E_PORT`). Stop your own dev server first.
The first run needs `pnpm exec playwright install chromium`.

- **Login:** sign-up with the emailed code (read from Mailpit), password sign-in, wrong password, password reset, and a
  guest cart kept after sign-up.
- **Checkout:** needs Razorpay **test** keys (`rzp_test_…`) in `.env.local` or the shell; it is skipped without them
  and refuses live keys. The server creates a real test-mode Razorpay order. The browser's Checkout widget is stubbed:
  it delivers a signed `payment.captured` webhook (the source of truth) and returns a signed success response. Then
  the test checks the order is confirmed and the invoice PDF downloads.

### Manual Razorpay test-mode run

To click through checkout by hand with the real Razorpay popup, webhooks and refunds, without real money and without
touching the hosted DB:

1. `supabase start` and `supabase db reset`. Create an owner in Studio (`http://127.0.0.1:54323`) and set
   `profiles.role = 'owner'`.
2. Create a gitignored `.env.development.local`. `next dev` loads it before `.env.local`. Put the local stack URL and
   keys in it, the always-pass Turnstile keys (`1x00000000000000000000AA` / `1x0000000000000000000000000000000AA`),
   Razorpay **test** keys, a random `RAZORPAY_WEBHOOK_SECRET`, and an empty `RESEND_API_KEY` (emails are logged).
   Delete the file to go back to the hosted project.
3. `pnpm dev`, then `cloudflared tunnel --url http://localhost:3000`. Browse at `http://localhost:3000`; only the
   webhook goes through the tunnel.
4. Razorpay dashboard in **Test mode** → Webhooks: `https://<tunnel>.trycloudflare.com/api/razorpay/webhook` with
   the same secret, for `payment.captured`, `payment.failed`, `refund.processed`, `refund.failed`. The quick-tunnel
   URL changes on every run.
5. Pay with UPI `success@razorpay` / `failure@razorpay` or card `4111 1111 1111 1111`.

## Deploying (production)

Hosting is Vercel **Pro** + Supabase **Pro** (Hobby forbids commercial use).

1. **Supabase:** apply all migrations in `supabase/migrations/` (do not run `seed.sql` sample products in production;
   seed only tax slabs, shipping zones, states and settings rows). Enable backups or PITR. Confirm the pg_cron jobs
   `expire-pending-orders`, `stale-anonymous-users-cleanup` and `rate-limits-cleanup` are active.
2. **Supabase Auth:**
   - Site URL and redirect URLs set to the production domain.
   - Anonymous sign-ins on, with Turnstile captcha (production secret).
   - Email provider on, **Confirm email** on. Phone provider off; no Send SMS Hook.
   - Minimum password length 8; turn on leaked-password protection.
   - Confirmation and Reset password templates: paste `supabase/templates/confirmation.html` and `recovery.html`
     (they show the 6-digit `{{ .Token }}`, not a link). Email change uses `email-change.html`.
   - Custom SMTP is Resend.
3. **Vercel env:** every variable in `.env.example`, with production values.
   - A random `ORDER_LINK_SECRET` of at least 32 characters.
   - `SENTRY_ORG`, `SENTRY_PROJECT` and `SENTRY_AUTH_TOKEN` for source maps.
4. **Razorpay:** live keys after KYC. Auto-capture on. Webhook at `https://<domain>/api/razorpay/webhook` for
   `payment.captured`, `payment.failed`, `refund.processed` and `refund.failed`, with `RAZORPAY_WEBHOOK_SECRET`.
5. **Resend:** sending domain verified (SPF, DKIM, DMARC). `EMAIL_FROM` uses that domain.
6. **Cloudflare:**
   - R2 public bucket on a custom domain (`NEXT_PUBLIC_MEDIA_URL`), plus a private bucket.
   - CORS rule on the public bucket allowing `PUT` from the site origin.
   - Image Resizing enabled.
   - Turnstile widget for the production hostname.
7. **Store data (admin → Settings):**
   - Legal name, GSTIN and address.
   - Tax slab basis and shipping tax rate, confirmed by the CA.
   - Final text for every policy page.
   - Real products in place of the samples.
   - An owner account: create the user with an email + password (Supabase dashboard → Authentication → Add user,
     auto-confirm), then set `profiles.role = 'owner'` for it. Admins sign in at `/admin/login`.
