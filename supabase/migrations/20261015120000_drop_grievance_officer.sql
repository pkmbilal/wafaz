-- Drop the grievance officer details and page (owner decision, 2026-10-15).

-- The view's return type changes, so drop and recreate it rather than `create or replace`.
drop view public.public_store_settings;
drop function private.public_store_settings();

alter table public.store_settings
  drop column grievance_officer_name,
  drop column grievance_officer_email,
  drop column grievance_officer_phone;

-- Public fields for storefront pages (footer, contact page).
-- A definer function in `private` reads the admin-only table; the view on top is invoker-safe.
create function private.public_store_settings()
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
  new_badge_days integer
)
language sql
stable
security definer
set search_path = ''
as $$
  select legal_name, trade_name, gstin, address_line1, address_line2, city, state, state_code,
         pincode, support_email, support_phone, new_badge_days
  from public.store_settings
  where id = 1;
$$;

revoke all on function private.public_store_settings() from public;
grant execute on function private.public_store_settings() to anon, authenticated, service_role;

create view public.public_store_settings
with (security_invoker = true) as
  select * from private.public_store_settings();

grant select on public.public_store_settings to anon, authenticated;

delete from public.pages where slug = 'grievance-officer';
