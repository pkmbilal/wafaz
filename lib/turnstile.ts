import "server-only";
import { serverEnv } from "@/lib/env.server";

// Server-side Cloudflare Turnstile check for actions Supabase Auth doesn't cover (order creation).
// Fails closed: any error counts as "not verified".
export async function verifyTurnstile(token: string, ip?: string): Promise<boolean> {
  if (!token || token.length > 2048) return false;
  const body = new URLSearchParams({ secret: serverEnv().TURNSTILE_SECRET_KEY, response: token });
  if (ip && ip !== "unknown") body.set("remoteip", ip);
  try {
    const res = await fetch("https://challenges.cloudflare.com/turnstile/v0/siteverify", {
      method: "POST",
      body,
      signal: AbortSignal.timeout(8000),
    });
    if (!res.ok) return false;
    const data = (await res.json()) as { success?: boolean };
    return data.success === true;
  } catch {
    return false;
  }
}
