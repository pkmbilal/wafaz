-- check_rate_limit takes any key, so signed-in callers could burn someone else's counter
-- (e.g. another person's OTP limit). Keep it for the service role only (OTP limits before a
-- session exists) and give signed-in users a variant keyed to their own uid.

revoke execute on function public.check_rate_limit(text, integer, integer) from authenticated;

create or replace function public.check_my_rate_limit(p_scope text, p_max integer, p_window_seconds integer)
returns boolean
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_uid uuid := (select auth.uid());
begin
  if v_uid is null then
    raise exception 'not signed in' using errcode = '42501';
  end if;
  if p_scope !~ '^[a-z][a-z0-9-]{0,39}$' then
    raise exception 'invalid rate limit scope' using errcode = '22023';
  end if;
  return public.check_rate_limit('self:' || p_scope || ':' || v_uid::text, p_max, p_window_seconds);
end;
$$;

revoke all on function public.check_my_rate_limit(text, integer, integer) from public, anon;
grant execute on function public.check_my_rate_limit(text, integer, integer) to authenticated;
