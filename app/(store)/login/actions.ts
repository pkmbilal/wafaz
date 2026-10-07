"use server";

import { headers } from "next/headers";
import { z } from "zod";
import { RATE_LIMITS, rateLimit } from "@/lib/rate-limit";
import { clientIp } from "@/lib/request";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { emailSchema, phoneSchema, safeNextPath } from "@/lib/validators/auth";

// Supabase Auth itself (signInWithOtp, updateUser, verifyOtp) is called from the browser so its
// built-in per-IP limits see the customer's IP, not the server's. These actions add the app-side
// rate limits (AGENTS.md §5.8) and the guest merge, which need the server.

type ActionResult = { ok: true } | { ok: false; error: string };

const prepareSchema = z.discriminatedUnion("channel", [
  z.object({ channel: z.literal("whatsapp"), identifier: phoneSchema }),
  z.object({ channel: z.literal("email"), identifier: emailSchema }),
]);

// Call before every OTP request. 5 per phone/email per hour, 20 per IP per hour.
export async function prepareOtpRequest(input: unknown): Promise<ActionResult> {
  const parsed = prepareSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Check your details" };
  }

  const ip = clientIp(await headers());
  const [ipOk, identifierOk] = await Promise.all([
    rateLimit("otp:ip", ip, RATE_LIMITS.otpPerIp),
    rateLimit(`otp:${parsed.data.channel}`, parsed.data.identifier, RATE_LIMITS.otpPerIdentifier),
  ]);
  if (!ipOk || !identifierOk) {
    return { ok: false, error: "Too many codes requested. Please try again in an hour." };
  }
  return { ok: true };
}

const finishSchema = z.object({
  // Access token of the guest session the browser held before verifying, if it was anonymous.
  guestAccessToken: z.string().max(8192).optional(),
  next: z.string().max(500).optional(),
});

// Runs after a successful verifyOtp. If the visitor was a guest and signed in to a different,
// existing account, moves the guest's data across (merge_guest_into_user, service role).
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
    // TODO(owner): report to Sentry once it is set up (Engineering milestone).
    console.error("[login] guest merge failed", error.code);
  }
  return { ok: true, redirectTo };
}

export async function signOut(): Promise<void> {
  const supabase = await createClient();
  await supabase.auth.signOut();
}
