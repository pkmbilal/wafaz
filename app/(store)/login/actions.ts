"use server";

import { headers } from "next/headers";
import { z } from "zod";
import { RATE_LIMITS, rateLimit } from "@/lib/rate-limit";
import { clientIp } from "@/lib/request";
import { createAdminClient } from "@/lib/supabase/admin";
import { reportError } from "@/lib/observability";
import { createClient } from "@/lib/supabase/server";
import { emailSchema, safeNextPath } from "@/lib/validators/auth";

// Supabase Auth itself (signUp, signInWithPassword, verifyOtp, ...) is called from the browser so
// its built-in per-IP limits see the customer's IP, not the server's, and passwords never pass
// through our server. These actions add the app-side rate limits (AGENTS.md §5.8) and the guest
// merge, which need the server.

type ActionResult = { ok: true } | { ok: false; error: string };

const prepareSchema = z.object({
  // "login": a password attempt. "email": anything that sends an auth email (sign-up, resend, reset).
  kind: z.enum(["login", "email"]),
  email: emailSchema,
});

// Call before every password attempt (10 per email / 30 per IP per 15 min) and before every
// auth email (5 per email / 20 per IP per hour).
export async function prepareAuthRequest(input: unknown): Promise<ActionResult> {
  const parsed = prepareSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Check your details" };
  }

  const { kind, email } = parsed.data;
  const ip = clientIp(await headers());
  const [ipOk, emailOk] =
    kind === "login"
      ? await Promise.all([
          rateLimit("login:ip", ip, RATE_LIMITS.loginPerIp),
          rateLimit("login:email", email, RATE_LIMITS.loginPerEmail),
        ])
      : await Promise.all([
          rateLimit("auth-email:ip", ip, RATE_LIMITS.authEmailPerIp),
          rateLimit("auth-email:email", email, RATE_LIMITS.authEmailPerEmail),
        ]);
  if (!ipOk || !emailOk) {
    return {
      ok: false,
      error:
        kind === "login"
          ? "Too many attempts. Please try again in 15 minutes."
          : "Too many emails requested. Please try again in an hour.",
    };
  }
  return { ok: true };
}

const finishSchema = z.object({
  // Access token of the guest session the browser held before verifying, if it was anonymous.
  guestAccessToken: z.string().max(8192).optional(),
  next: z.string().max(500).optional(),
});

// Runs once the browser holds a real session (password sign-in, confirmed sign-up or password
// reset). If the visitor was a guest, moves the guest's data across (merge_guest_into_user, service role).
export async function finishLogin(
  input: unknown,
): Promise<{ ok: true; redirectTo: string } | { ok: false; error: string }> {
  const parsed = finishSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Something went wrong. Please try again." };

  const supabase = await createClient();
  const { data: current } = await supabase.auth.getClaims();
  const userId = current?.claims.sub;
  if (!userId || current.claims.is_anonymous) {
    return { ok: false, error: "Your sign-in didn't complete. Please try again." };
  }

  const redirectTo = safeNextPath(parsed.data.next);
  const token = parsed.data.guestAccessToken;
  if (!token) return { ok: true, redirectTo };

  // The JWT's signature proves the caller held that guest session, so nobody can merge a
  // guest uid they merely know. An expired or invalid token simply skips the merge.
  const { data: guest } = await supabase.auth.getClaims(token);
  const guestId = guest?.claims.sub;
  if (!guestId || guest.claims.is_anonymous !== true || guestId === userId) {
    return { ok: true, redirectTo };
  }

  const { error } = await createAdminClient().rpc("merge_guest_into_user", {
    p_anon_uid: guestId,
    p_user_id: userId,
  });
  if (error) {
    // The login itself succeeded; the guest data stays on the guest uid until cleanup.
    console.error("[login] guest merge failed", error.code);
    reportError("guest-merge", error);
  }
  return { ok: true, redirectTo };
}

export async function signOut(): Promise<void> {
  const supabase = await createClient();
  await supabase.auth.signOut();
}
