import "server-only";
import { render } from "@react-email/components";
import { Resend } from "resend";
import { plainTextOptions } from "@/emails/components";
import { serverEnv } from "@/lib/env.server";
import { reportError } from "@/lib/observability";
import { hashIdentifier } from "@/lib/request";
import type { createAdminClient } from "@/lib/supabase/admin";

// Transactional email via Resend (AGENTS.md §2). Every logical email has a dedupe key and a row in
// email_events, so a retried webhook never sends the same email twice. Sending never throws: a
// failure is recorded on the row (feeds "Needs attention") and reported to the caller.

type AdminClient = ReturnType<typeof createAdminClient>;

export type EmailKind =
  | "order_confirmed"
  | "late_payment_refunded"
  | "order_shipped"
  | "order_delivered"
  | "order_cancelled"
  | "order_refunded"
  | "admin_needs_attention";

export type EmailOutcome = "sent" | "dry_run" | "skipped" | "failed";

export type EmailMessage = {
  kind: EmailKind;
  dedupeKey: string;
  orderId: string | null;
  to: string;
  replyTo?: string;
  subject: string;
  react: React.ReactElement;
};

export type EmailTransport = (input: {
  from: string;
  to: string;
  replyTo?: string;
  subject: string;
  html: string;
  text: string;
  idempotencyKey: string;
}) => Promise<{ id: string }>;

let client: Resend | undefined;

// Resend with its own idempotency key as a second guard against double sends.
const resendTransport: EmailTransport = async ({ idempotencyKey, ...email }) => {
  client ??= new Resend(serverEnv().RESEND_API_KEY);
  const { data, error } = await client.emails.send(email, { idempotencyKey });
  if (error || !data) throw new Error(`resend: ${error?.name ?? "unknown"}: ${error?.message ?? "no data"}`);
  return { id: data.id };
};

function defaultTransport(): EmailTransport | "dry_run" | "unconfigured" {
  const env = serverEnv();
  if (env.RESEND_API_KEY && env.EMAIL_FROM) return resendTransport;
  return process.env.NODE_ENV === "production" ? "unconfigured" : "dry_run";
}

export async function sendEmail(
  admin: AdminClient,
  message: EmailMessage,
  transport: EmailTransport | "dry_run" | "unconfigured" = defaultTransport(),
): Promise<EmailOutcome> {
  const claimed = await claim(admin, message);
  if (!claimed) return "skipped";

  const finish = async (status: "sent" | "failed" | "dry_run", extra: { error?: string; id?: string } = {}) => {
    await admin
      .from("email_events")
      .update({
        status,
        error: extra.error?.slice(0, 1000) ?? null,
        provider_message_id: extra.id ?? null,
      })
      .eq("dedupe_key", message.dedupeKey);
    return status;
  };

  try {
    if (transport === "unconfigured") return await finish("failed", { error: "RESEND_API_KEY or EMAIL_FROM not set" });
    const html = await render(message.react);
    if (transport === "dry_run") {
      // Never log the address or body (PII); the kind and key are enough to see it fired.
      console.info(`[email:dry-run] ${message.kind} ${message.dedupeKey} "${message.subject}"`);
      return await finish("dry_run");
    }
    const text = await render(message.react, { plainText: true, htmlToTextOptions: plainTextOptions });
    const { id } = await transport({
      from: serverEnv().EMAIL_FROM ?? "",
      to: message.to,
      replyTo: message.replyTo,
      subject: message.subject,
      html,
      text,
      idempotencyKey: message.dedupeKey,
    });
    return await finish("sent", { id });
  } catch (e) {
    console.error(`[email] ${message.kind} failed`, message.dedupeKey);
    reportError("email", e, { kind: message.kind });
    return await finish("failed", { error: e instanceof Error ? e.message : "unknown error" });
  }
}

// Takes the email_events row for this dedupe key. False when it was already sent (or another
// sender holds it); a failed or abandoned pending row is retried.
async function claim(admin: AdminClient, message: EmailMessage): Promise<boolean> {
  const { data: existing } = await admin
    .from("email_events")
    .select("status, attempts, updated_at")
    .eq("dedupe_key", message.dedupeKey)
    .maybeSingle();

  if (!existing) {
    const { error } = await admin.from("email_events").insert({
      order_id: message.orderId,
      kind: message.kind,
      dedupe_key: message.dedupeKey,
      recipient_hash: hashIdentifier(message.to.trim().toLowerCase()),
    });
    // A unique violation means a concurrent sender claimed it first.
    return !error;
  }

  if (existing.status === "sent" || existing.status === "dry_run") return false;
  const stalePending = Date.now() - new Date(existing.updated_at).getTime() > 10 * 60 * 1000;
  if (existing.status === "pending" && !stalePending) return false;

  // Compare-and-set on attempts so two retries can't both proceed.
  const { data: updated } = await admin
    .from("email_events")
    .update({ status: "pending", attempts: existing.attempts + 1, error: null })
    .eq("dedupe_key", message.dedupeKey)
    .eq("attempts", existing.attempts)
    .select("id");
  return (updated?.length ?? 0) > 0;
}
