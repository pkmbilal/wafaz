-- M4 auth and account: saved addresses, WhatsApp OTP hook log, profile contact sync,
-- guest → account merge and stale anonymous user cleanup.
-- See docs/DATA_MODEL.md §2 (Users, auth_hook_events), §3 (RLS) and §5 (merge_guest_into_user).

-- ---------------------------------------------------------------------------
-- Profile contact sync
-- ---------------------------------------------------------------------------
-- Auth stores phone without '+'. Only numbers that pass our Indian E.164 check are kept.
create or replace function private.normalize_auth_phone(p_phone text)
returns text
language sql
immutable
set search_path = ''
as $$
  select case
    when p_phone is null or p_phone = '' then null
    when (case when p_phone like '+%' then p_phone else '+' || p_phone end) ~ '^\+91[6-9]\d{9}$'
      then case when p_phone like '+%' then p_phone else '+' || p_phone end
  end;
$$;

create or replace function private.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, phone, email)
  values (new.id, private.normalize_auth_phone(new.phone), nullif(lower(trim(new.email)), ''));
  return new;
end;
$$;

-- A guest who upgrades via updateUser({ phone | email }) keeps their uid; mirror the verified
-- contact details onto the profile so checkout and admin see them.
create or replace function private.handle_user_contact_change()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.profiles
  set phone = coalesce(private.normalize_auth_phone(new.phone), phone),
      email = coalesce(nullif(lower(trim(new.email)), ''), email)
  where id = new.id;
  return new;
end;
$$;

create trigger on_auth_user_contact_changed
  after update of phone, email on auth.users
  for each row
  when (old.phone is distinct from new.phone or old.email is distinct from new.email)
  execute function private.handle_user_contact_change();

-- ---------------------------------------------------------------------------
-- addresses
-- ---------------------------------------------------------------------------
create table public.addresses (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  name text not null check (char_length(name) between 1 and 120),
  phone text not null check (phone ~ '^\+91[6-9]\d{9}$'),
  line1 text not null check (char_length(line1) between 1 and 200),
  line2 text check (char_length(line2) <= 200),
  city text not null check (char_length(city) between 1 and 100),
  state_code text not null references public.indian_states (code) on delete restrict,
  pincode text not null check (pincode ~ '^\d{6}$'),
  is_default boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index addresses_user_id_idx on public.addresses (user_id);
create index addresses_state_code_idx on public.addresses (state_code);
-- At most one default address per user.
create unique index addresses_one_default_idx on public.addresses (user_id) where is_default;

create trigger addresses_set_updated_at
  before update on public.addresses
  for each row execute function private.set_updated_at();

alter table public.addresses enable row level security;

create policy "addresses: read own or admin"
  on public.addresses for select
  to authenticated
  using (user_id = (select auth.uid()) or (select private.is_admin()));

create policy "addresses: insert own"
  on public.addresses for insert
  to authenticated
  with check (user_id = (select auth.uid()));

create policy "addresses: update own"
  on public.addresses for update
  to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

create policy "addresses: delete own"
  on public.addresses for delete
  to authenticated
  using (user_id = (select auth.uid()));

revoke all on public.addresses from anon;

-- Makes one address the default and clears the others in a single statement-safe step.
create or replace function public.set_default_address(p_address_id uuid)
returns void
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_uid uuid := (select auth.uid());
begin
  if not exists (select 1 from public.addresses where id = p_address_id and user_id = v_uid) then
    raise exception 'address not found' using errcode = 'P0002';
  end if;

  update public.addresses set is_default = false
  where user_id = v_uid and is_default and id <> p_address_id;

  update public.addresses set is_default = true where id = p_address_id;
end;
$$;

revoke all on function public.set_default_address(uuid) from public, anon;
grant execute on function public.set_default_address(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- auth_hook_events (Send SMS Hook → WhatsApp OTP log, no raw PII)
-- ---------------------------------------------------------------------------
create table public.auth_hook_events (
  id uuid primary key default gen_random_uuid(),
  channel text not null default 'whatsapp' check (channel in ('whatsapp')),
  recipient_hash text not null check (recipient_hash ~ '^[0-9a-f]{64}$'),
  status text not null check (status in ('sent', 'failed', 'dry_run')),
  error text check (char_length(error) <= 1000),
  provider_message_id text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- "Needs attention": failed sends in the last 24 hours.
create index auth_hook_events_status_created_at_idx on public.auth_hook_events (status, created_at);

create trigger auth_hook_events_set_updated_at
  before update on public.auth_hook_events
  for each row execute function private.set_updated_at();

alter table public.auth_hook_events enable row level security;

create policy "auth_hook_events: owner read"
  on public.auth_hook_events for select
  to authenticated
  using ((select private.is_owner()));

revoke insert, update, delete on public.auth_hook_events from anon, authenticated;

-- ---------------------------------------------------------------------------
-- merge_guest_into_user (service role only, called from the login Server Action)
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

  -- TODO(M5): merge cart lines (sum quantities, cap at 10).
  -- TODO(M6): reassign the guest's orders.

  delete from auth.users where id = p_anon_uid;
end;
$$;

revoke all on function public.merge_guest_into_user(uuid, uuid) from public, anon, authenticated;
grant execute on function public.merge_guest_into_user(uuid, uuid) to service_role;

-- ---------------------------------------------------------------------------
-- Stale anonymous users (daily)
-- ---------------------------------------------------------------------------
create or replace function private.delete_stale_anonymous_users()
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_count integer;
begin
  -- TODO(M6): also require "no orders" once the orders table exists.
  delete from auth.users
  where is_anonymous and created_at < now() - interval '30 days';
  get diagnostics v_count = row_count;
  return v_count;
end;
$$;

revoke all on function private.delete_stale_anonymous_users() from public, anon, authenticated;
grant execute on function private.delete_stale_anonymous_users() to service_role;

select cron.schedule(
  'stale-anonymous-users-cleanup',
  '30 21 * * *', -- 03:00 IST
  $$select private.delete_stale_anonymous_users()$$
);
