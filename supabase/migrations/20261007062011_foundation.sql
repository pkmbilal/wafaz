-- M1 foundation: extensions, shared helpers, store settings, Indian states, profiles, rate limits.
-- See docs/DATA_MODEL.md §1 (conventions), §2 (tables) and §3 (RLS).

-- ---------------------------------------------------------------------------
-- Extensions
-- ---------------------------------------------------------------------------
create extension if not exists pgcrypto with schema extensions;
create extension if not exists pg_trgm with schema extensions;
create extension if not exists btree_gist with schema extensions;
create extension if not exists pg_cron;

-- Helpers that must not be exposed through the Data API live in `private`.
create schema if not exists private;
revoke all on schema private from public;
grant usage on schema private to anon, authenticated, service_role;

-- ---------------------------------------------------------------------------
-- Shared trigger: keep updated_at current
-- ---------------------------------------------------------------------------
create or replace function private.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

-- ---------------------------------------------------------------------------
-- indian_states (GST state codes, reference data)
-- ---------------------------------------------------------------------------
create table public.indian_states (
  code text primary key check (code ~ '^\d{2}$'),
  name text not null unique,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger indian_states_set_updated_at
  before update on public.indian_states
  for each row execute function private.set_updated_at();

insert into public.indian_states (code, name) values
  ('01', 'Jammu and Kashmir'),
  ('02', 'Himachal Pradesh'),
  ('03', 'Punjab'),
  ('04', 'Chandigarh'),
  ('05', 'Uttarakhand'),
  ('06', 'Haryana'),
  ('07', 'Delhi'),
  ('08', 'Rajasthan'),
  ('09', 'Uttar Pradesh'),
  ('10', 'Bihar'),
  ('11', 'Sikkim'),
  ('12', 'Arunachal Pradesh'),
  ('13', 'Nagaland'),
  ('14', 'Manipur'),
  ('15', 'Mizoram'),
  ('16', 'Tripura'),
  ('17', 'Meghalaya'),
  ('18', 'Assam'),
  ('19', 'West Bengal'),
  ('20', 'Jharkhand'),
  ('21', 'Odisha'),
  ('22', 'Chhattisgarh'),
  ('23', 'Madhya Pradesh'),
  ('24', 'Gujarat'),
  ('26', 'Dadra and Nagar Haveli and Daman and Diu'),
  ('27', 'Maharashtra'),
  ('29', 'Karnataka'),
  ('30', 'Goa'),
  ('31', 'Lakshadweep'),
  ('32', 'Kerala'),
  ('33', 'Tamil Nadu'),
  ('34', 'Puducherry'),
  ('35', 'Andaman and Nicobar Islands'),
  ('36', 'Telangana'),
  ('37', 'Andhra Pradesh'),
  ('38', 'Ladakh');

-- ---------------------------------------------------------------------------
-- profiles (one per auth.users row, including anonymous users)
-- ---------------------------------------------------------------------------
create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  full_name text check (char_length(full_name) <= 120),
  phone text check (phone ~ '^\+91[6-9]\d{9}$'),
  email text check (char_length(email) <= 254),
  role text not null default 'customer' check (role in ('customer', 'staff', 'owner')),
  marketing_consent boolean not null default false,
  marketing_consent_at timestamptz,
  deletion_requested_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index profiles_staff_role_idx on public.profiles (role) where role <> 'customer';

create trigger profiles_set_updated_at
  before update on public.profiles
  for each row execute function private.set_updated_at();

-- Role helpers used by RLS policies and route guards.
create or replace function private.is_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.profiles
    where id = (select auth.uid()) and role in ('owner', 'staff')
  );
$$;

create or replace function private.is_owner()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.profiles
    where id = (select auth.uid()) and role = 'owner'
  );
$$;

revoke all on function private.is_admin() from public;
revoke all on function private.is_owner() from public;
grant execute on function private.is_admin() to anon, authenticated, service_role;
grant execute on function private.is_owner() to anon, authenticated, service_role;

-- Create the profile when an auth user is created (anonymous, phone or email).
create or replace function private.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_phone text := case
    when new.phone is null or new.phone = '' then null
    when new.phone like '+%' then new.phone
    else '+' || new.phone
  end;
begin
  insert into public.profiles (id, phone, email)
  values (
    new.id,
    -- Auth stores phone without '+'; only keep numbers that pass our Indian E.164 check.
    case when v_phone ~ '^\+91[6-9]\d{9}$' then v_phone end,
    nullif(lower(trim(new.email)), '')
  );
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function private.handle_new_user();

-- Customers can never change roles. Owners change roles through admin Server Actions (service role);
-- this trigger is the backstop if a column grant is ever loosened.
create or replace function private.guard_profile_role()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.role is distinct from old.role
     and current_user in ('anon', 'authenticated')
     and not private.is_owner() then
    raise exception 'only the owner can change roles' using errcode = '42501';
  end if;
  return new;
end;
$$;

create trigger profiles_guard_role
  before update on public.profiles
  for each row execute function private.guard_profile_role();

-- Column-level grants: signed-in users may only update these columns.
revoke insert, update, delete on public.profiles from anon, authenticated;
grant update (full_name, phone, email, marketing_consent, marketing_consent_at, deletion_requested_at)
  on public.profiles to authenticated;

alter table public.profiles enable row level security;

create policy "profiles: read own or admin"
  on public.profiles for select
  to authenticated
  using (id = (select auth.uid()) or (select private.is_admin()));

create policy "profiles: update own"
  on public.profiles for update
  to authenticated
  using (id = (select auth.uid()))
  with check (id = (select auth.uid()));

-- ---------------------------------------------------------------------------
-- store_settings (singleton)
-- ---------------------------------------------------------------------------
create table public.store_settings (
  id smallint primary key default 1 check (id = 1),
  legal_name text not null,
  trade_name text not null,
  gstin text check (gstin ~ '^\d{2}[A-Z]{5}\d{4}[A-Z][1-9A-Z]Z[0-9A-Z]$'),
  address_line1 text not null,
  address_line2 text,
  city text not null,
  state text not null,
  state_code text not null default '32' references public.indian_states (code) on delete restrict,
  pincode text not null check (pincode ~ '^\d{6}$'),
  support_email text not null,
  support_phone text not null,
  grievance_officer_name text not null,
  grievance_officer_email text not null,
  grievance_officer_phone text not null,
  -- 'PFX/26-27/00001' must stay <= 16 chars
  invoice_prefix text not null default 'INV' check (invoice_prefix ~ '^[A-Z]{1,5}$'),
  credit_note_prefix text not null default 'CN' check (credit_note_prefix ~ '^[A-Z]{1,5}$'),
  tax_slab_basis text not null default 'inclusive' check (tax_slab_basis in ('inclusive', 'taxable')),
  shipping_tax_rate_bps integer check (shipping_tax_rate_bps between 0 and 10000),
  low_stock_threshold integer not null default 3 check (low_stock_threshold >= 0),
  new_badge_days integer not null default 30 check (new_badge_days >= 0),
  einvoice_enabled boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index store_settings_state_code_idx on public.store_settings (state_code);

create trigger store_settings_set_updated_at
  before update on public.store_settings
  for each row execute function private.set_updated_at();

alter table public.store_settings enable row level security;

create policy "store_settings: admin read"
  on public.store_settings for select
  to authenticated
  using ((select private.is_admin()));

create policy "store_settings: owner update"
  on public.store_settings for update
  to authenticated
  using ((select private.is_owner()))
  with check ((select private.is_owner()));

revoke insert, delete on public.store_settings from anon, authenticated;

-- TODO(owner): replace placeholders with the real legal details, GSTIN and grievance officer.
-- TODO(owner): CA to confirm tax_slab_basis and shipping_tax_rate_bps.
insert into public.store_settings (
  legal_name, trade_name, address_line1, city, state, state_code, pincode,
  support_email, support_phone,
  grievance_officer_name, grievance_officer_email, grievance_officer_phone
) values (
  'TODO Legal Name', 'Wafaz', 'TODO Address', 'Kochi', 'Kerala', '32', '682001',
  'support@example.com', '+910000000000',
  'TODO Grievance Officer', 'grievance@example.com', '+910000000000'
);

-- Public fields for storefront pages (footer, contact, grievance officer page).
-- A definer function in `private` reads the admin-only table; the view on top is invoker-safe.
create or replace function private.public_store_settings()
returns table (
  legal_name text,
  trade_name text,
  gstin text,
  address_line1 text,
  address_line2 text,
  city text,
  state text,
  state_code text,
  pincode text,
  support_email text,
  support_phone text,
  grievance_officer_name text,
  grievance_officer_email text,
  grievance_officer_phone text,
  new_badge_days integer
)
language sql
stable
security definer
set search_path = ''
as $$
  select legal_name, trade_name, gstin, address_line1, address_line2, city, state, state_code,
         pincode, support_email, support_phone, grievance_officer_name, grievance_officer_email,
         grievance_officer_phone, new_badge_days
  from public.store_settings
  where id = 1;
$$;

revoke all on function private.public_store_settings() from public;
grant execute on function private.public_store_settings() to anon, authenticated, service_role;

create view public.public_store_settings
with (security_invoker = true) as
  select * from private.public_store_settings();

grant select on public.public_store_settings to anon, authenticated;

-- ---------------------------------------------------------------------------
-- indian_states RLS (readable by everyone, admin-managed)
-- ---------------------------------------------------------------------------
alter table public.indian_states enable row level security;

create policy "indian_states: public read"
  on public.indian_states for select
  to anon, authenticated
  using (true);

create policy "indian_states: admin insert"
  on public.indian_states for insert
  to authenticated
  with check ((select private.is_admin()));

create policy "indian_states: admin update"
  on public.indian_states for update
  to authenticated
  using ((select private.is_admin()))
  with check ((select private.is_admin()));

-- ---------------------------------------------------------------------------
-- rate_limits + check_rate_limit()
-- ---------------------------------------------------------------------------
create table public.rate_limits (
  key text not null check (char_length(key) <= 200),
  window_start timestamptz not null,
  count integer not null default 0 check (count >= 0),
  primary key (key, window_start)
);

create index rate_limits_window_start_idx on public.rate_limits (window_start);

alter table public.rate_limits enable row level security;

create policy "rate_limits: admin read"
  on public.rate_limits for select
  to authenticated
  using ((select private.is_admin()));

revoke insert, update, delete on public.rate_limits from anon, authenticated;

-- Fixed-window counter. Returns true while the caller is within the limit.
-- Callable before login (OTP requests), so anon may execute it; abusing it can only exhaust a
-- key that the same caller could exhaust by sending real requests.
create or replace function public.check_rate_limit(p_key text, p_max integer, p_window_seconds integer)
returns boolean
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_window timestamptz;
  v_count integer;
begin
  if p_max < 1 or p_window_seconds < 1 then
    raise exception 'invalid rate limit arguments' using errcode = '22023';
  end if;

  v_window := to_timestamp(floor(extract(epoch from now()) / p_window_seconds) * p_window_seconds);

  insert into public.rate_limits as rl (key, window_start, count)
  values (p_key, v_window, 1)
  on conflict (key, window_start) do update set count = rl.count + 1
  returning rl.count into v_count;

  return v_count <= p_max;
end;
$$;

revoke all on function public.check_rate_limit(text, integer, integer) from public;
grant execute on function public.check_rate_limit(text, integer, integer) to anon, authenticated, service_role;

select cron.schedule(
  'rate-limits-cleanup',
  '15 21 * * *', -- 02:45 IST
  $$delete from public.rate_limits where window_start < now() - interval '1 day'$$
);
