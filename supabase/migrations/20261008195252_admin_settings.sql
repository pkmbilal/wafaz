-- M10 admin settings: owner-only coupon writes and account deletion processing.
-- See docs/DATA_MODEL.md §2, §3 and §5.

-- ---------------------------------------------------------------------------
-- Coupons: staff read, owner writes (DATA_MODEL §3). Column grants still keep used_count read-only.
-- ---------------------------------------------------------------------------
drop policy "coupons: admin insert" on public.coupons;
drop policy "coupons: admin update" on public.coupons;

create policy "coupons: owner insert" on public.coupons for insert to authenticated
  with check ((select private.is_owner()));
create policy "coupons: owner update" on public.coupons for update to authenticated
  using ((select private.is_owner())) with check ((select private.is_owner()));

-- Inserts may only set the rule columns, never the redemption counter.
revoke insert on public.coupons from authenticated;
grant insert (code, kind, value, max_discount_paise, min_cart_paise, max_uses, per_user_limit,
              first_order_only, starts_at, ends_at, is_active)
  on public.coupons to authenticated;

-- ---------------------------------------------------------------------------
-- Account deletion. Customers request it (profiles.deletion_requested_at); the owner processes it.
-- Not in the customer column grants, so only this function sets it.
-- ---------------------------------------------------------------------------
alter table public.profiles add column deletion_processed_at timestamptz;

create index profiles_deletion_pending_idx on public.profiles (deletion_requested_at)
  where deletion_requested_at is not null and deletion_processed_at is null;

-- Wipes the profile's personal data, saved addresses and cart. Orders, invoices and credit notes
-- keep their own frozen copies for tax records. Returns the number of orders the user has: with
-- none, the caller deletes the auth user outright; otherwise it anonymises and bans the login.
create or replace function public.process_account_deletion(p_user_id uuid)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_orders integer;
begin
  update public.profiles
  set full_name = null,
      phone = null,
      email = null,
      marketing_consent = false,
      marketing_consent_at = null,
      deletion_processed_at = now()
  where id = p_user_id
    and deletion_requested_at is not null
    and deletion_processed_at is null;
  if not found then
    raise exception 'deletion:not_requested' using errcode = 'P0002';
  end if;

  delete from public.addresses where user_id = p_user_id;
  delete from public.carts where user_id = p_user_id;

  select count(*) into v_orders from public.orders where user_id = p_user_id;
  return v_orders;
end;
$$;

revoke all on function public.process_account_deletion(uuid) from public, anon, authenticated;
grant execute on function public.process_account_deletion(uuid) to service_role;

-- The login of a processed account is anonymised afterwards; don't copy that back onto the profile.
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
  where id = new.id and deletion_processed_at is null;
  return new;
end;
$$;
