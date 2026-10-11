"use server";

import { headers } from "next/headers";
import { z } from "zod";
import { getAdminSession } from "@/lib/auth/guards";
import { RATE_LIMITS, rateLimit } from "@/lib/rate-limit";
import { clientIp } from "@/lib/request";
import { createClient } from "@/lib/supabase/server";
import { emailSchema } from "@/lib/validators/auth";

// Admin-only password sign-in (AGENTS.md §5.3 exception). As with OTP login, signInWithPassword
// runs in the browser so Supabase's per-IP limits see the real IP; these actions add the app-side
// rate limit and the role check. The password itself never reaches our server.

type ActionResult = { ok: true } | { ok: false; error: string };

const INVALID_LOGIN = "Invalid email or password.";

// Call before every password attempt.
export async function prepareAdminLogin(input: unknown): Promise<ActionResult> {
  const parsed = z.object({ email: emailSchema }).safeParse(input);
  if (!parsed.success) return { ok: false, error: INVALID_LOGIN };

  const ip = clientIp(await headers());
  const [ipOk, emailOk] = await Promise.all([
    rateLimit("admin-login:ip", ip, RATE_LIMITS.adminLogin),
    rateLimit("admin-login:email", parsed.data.email, RATE_LIMITS.adminLogin),
  ]);
  if (!ipOk || !emailOk) {
    return { ok: false, error: "Too many attempts. Please try again in 15 minutes." };
  }
  return { ok: true };
}

// Runs after a successful signInWithPassword. Non-admins are signed straight back out.
export async function finishAdminLogin(): Promise<ActionResult> {
  if (await getAdminSession()) return { ok: true };
  const supabase = await createClient();
  await supabase.auth.signOut();
  return { ok: false, error: INVALID_LOGIN };
}
