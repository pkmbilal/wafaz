-- M7: transactional email log. One row per logical email (dedupe_key), so a webhook retry never sends
-- the same email twice, and failed sends feed the admin "Needs attention" panel.
-- See docs/DATA_MODEL.md §2 (Infrastructure) and §3 (RLS).

create table public.email_events (
  id uuid primary key default gen_random_uuid(),
  order_id uuid references public.orders (id) on delete restrict,
  kind text not null check (kind in (
    'order_confirmed', 'late_payment_refunded', 'order_shipped', 'order_delivered',
    'order_cancelled', 'order_refunded', 'admin_needs_attention'
  )),
  -- e.g. 'order_confirmed:<order id>'; also sent to Resend as the idempotency key.
  dedupe_key text not null unique check (char_length(dedupe_key) <= 256),
  recipient_hash text not null check (recipient_hash ~ '^[0-9a-f]{64}$'),   -- sha256, no raw PII
  status text not null default 'pending' check (status in ('pending', 'sent', 'failed', 'dry_run')),
  attempts integer not null default 1 check (attempts > 0),
  error text check (char_length(error) <= 1000),
  provider_message_id text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index email_events_order_id_idx on public.email_events (order_id);
-- "Needs attention": failed sends in the last 24 hours.
create index email_events_status_created_at_idx on public.email_events (status, created_at);

create trigger email_events_set_updated_at
  before update on public.email_events
  for each row execute function private.set_updated_at();

alter table public.email_events enable row level security;

create policy "email_events: admin read"
  on public.email_events for select
  to authenticated
  using ((select private.is_admin()));

-- Written only by the server with the service role.
revoke insert, update, delete on public.email_events from anon, authenticated;
