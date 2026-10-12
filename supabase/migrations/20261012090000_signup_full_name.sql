-- Email + password sign-up (AGENTS.md §5.3): the sign-up form passes the customer's name as
-- user metadata, so copy it onto the new profile.
create or replace function private.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, phone, email, full_name)
  values (
    new.id,
    private.normalize_auth_phone(new.phone),
    nullif(lower(trim(new.email)), ''),
    nullif(left(trim(new.raw_user_meta_data ->> 'full_name'), 120), '')
  );
  return new;
end;
$$;
