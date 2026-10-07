import { Webhook, WebhookVerificationError } from "standardwebhooks";
import { z } from "zod";
import { serverEnv } from "@/lib/env.server";
import { normalizeIndianMobile } from "@/lib/validators/auth";
import { RATE_LIMITS, rateLimit } from "@/lib/rate-limit";
import { hashIdentifier } from "@/lib/request";
import { createAdminClient } from "@/lib/supabase/admin";
import { sendOtpTemplate } from "@/lib/whatsapp";

// Supabase Auth Send SMS Hook: delivers phone OTPs over WhatsApp (AGENTS.md §5.3).
// Supabase calls this for signInWithOtp({ phone }) and updateUser({ phone }).

// `sms.phone` is the destination. On a phone change it is the new number; `user.phone` is the old one.
const payloadSchema = z.object({
  sms: z.object({ otp: z.string().regex(/^\d{4,10}$/), phone: z.string().max(20) }),
});

// Supabase surfaces `message` to the client as the auth error.
function hookError(httpCode: number, message: string) {
  return Response.json({ error: { http_code: httpCode, message } }, { status: httpCode });
}

export async function POST(req: Request) {
  // Verify the signature on the raw body before parsing anything.
  const raw = await req.text();
  let body: unknown;
  try {
    const secret = serverEnv().SUPABASE_SEND_SMS_HOOK_SECRET.replace(/^v1,whsec_/, "");
    body = new Webhook(secret).verify(raw, Object.fromEntries(req.headers));
  } catch (err) {
    if (err instanceof WebhookVerificationError) return hookError(401, "Invalid signature");
    console.error("[send-otp] hook misconfigured");
    return hookError(500, "Could not send the code");
  }

  const parsed = payloadSchema.safeParse(body);
  const phone = parsed.success ? normalizeIndianMobile(parsed.data.sms.phone) : null;
  if (!parsed.success || !phone) {
    return hookError(400, "Enter a valid Indian mobile number");
  }

  // Enforced here as well as in the login action, because Supabase Auth can be called directly.
  if (!(await rateLimit("otp-hook:phone", phone, RATE_LIMITS.otpPerIdentifier))) {
    return hookError(429, "Too many codes requested. Try again in an hour or use email.");
  }

  const result = await sendOtpTemplate(phone, parsed.data.sms.otp);

  const { error: logError } = await createAdminClient()
    .from("auth_hook_events")
    .insert({
      channel: "whatsapp",
      recipient_hash: hashIdentifier(phone),
      status: result.status,
      error: result.status === "failed" ? result.error.slice(0, 1000) : null,
      provider_message_id: result.status === "sent" ? result.messageId : null,
    });
  if (logError) {
    // TODO(owner): report to Sentry once it is set up (Engineering milestone).
    console.error("[send-otp] could not record hook event", logError.code);
  }

  if (result.status === "failed") {
    console.error("[send-otp] WhatsApp send failed", result.error);
    return hookError(502, "We couldn't send the WhatsApp code. Try email instead.");
  }

  return Response.json({});
}
