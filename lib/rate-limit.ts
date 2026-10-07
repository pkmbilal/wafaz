import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { hashIdentifier } from "@/lib/request";

// Limits from AGENTS.md §5.8. Keys hold a hash, never the raw phone or email.
export const RATE_LIMITS = {
  otpPerIdentifier: { max: 5, windowSeconds: 3600 },
  otpPerIp: { max: 20, windowSeconds: 3600 },
  couponApply: { max: 10, windowSeconds: 600 },
  orderCreate: { max: 5, windowSeconds: 600 },
} as const;

type Limit = (typeof RATE_LIMITS)[keyof typeof RATE_LIMITS];

// Wraps the DB function check_rate_limit(). Called with the service role because the caller may
// not have a session yet (login), and so that nobody can burn another person's counter via RPC.
// Fails closed: a DB error counts as "over the limit".
export async function rateLimit(scope: string, subject: string, limit: Limit): Promise<boolean> {
  const { data, error } = await createAdminClient().rpc("check_rate_limit", {
    p_key: `${scope}:${hashIdentifier(subject)}`,
    p_max: limit.max,
    p_window_seconds: limit.windowSeconds,
  });
  if (error) {
    console.error("[rate-limit] check failed", error.code);
    return false;
  }
  return data === true;
}

type UserClient = Awaited<ReturnType<typeof import("@/lib/supabase/server").createClient>>;

// Per-user limits for signed-in callers (guests included): check_my_rate_limit() keys the counter
// to auth.uid(), so no service role is needed and nobody can use up someone else's counter.
export async function rateLimitSelf(supabase: UserClient, scope: string, limit: Limit): Promise<boolean> {
  const { data, error } = await supabase.rpc("check_my_rate_limit", {
    p_scope: scope,
    p_max: limit.max,
    p_window_seconds: limit.windowSeconds,
  });
  if (error) {
    console.error("[rate-limit] self check failed", error.code);
    return false;
  }
  return data === true;
}
