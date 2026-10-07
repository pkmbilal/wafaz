-- check_rate_limit is called from server code only. Keep it off the anon role;
-- pre-login callers (OTP) use the service-role client in the auth hook.
-- TODO(owner): revisit in M4 if per-IP OTP limits need a pre-session caller.
revoke execute on function public.check_rate_limit(text, integer, integer) from anon;
