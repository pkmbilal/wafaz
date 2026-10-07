import "server-only";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export type SessionUser = { id: string; isAnonymous: boolean };

// Current user from the verified JWT, or null. Reads cookies, so only call it from dynamic routes.
export async function getSessionUser(): Promise<SessionUser | null> {
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  const sub = data?.claims.sub;
  if (!sub) return null;
  return { id: sub, isAnonymous: data.claims.is_anonymous === true };
}

// Account pages: a registered (non-anonymous) user, or a redirect to login.
export async function requireUser(next = "/account"): Promise<{ id: string }> {
  const user = await getSessionUser();
  if (!user || user.isAnonymous) {
    redirect(`/login?next=${encodeURIComponent(next)}`);
  }
  return { id: user.id };
}
