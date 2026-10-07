import "server-only";
import { serverEnv } from "@/lib/env.server";
import { buildOtpTemplatePayload } from "@/lib/whatsapp-payload";

// Meta WhatsApp Cloud API client. Phase 1 only sends the OTP authentication template.
const GRAPH_API = "https://graph.facebook.com/v23.0";

export type WhatsAppSendResult =
  | { status: "sent"; messageId: string | null }
  | { status: "dry_run" }
  | { status: "failed"; error: string };

export async function sendOtpTemplate(toE164: string, code: string): Promise<WhatsAppSendResult> {
  const env = serverEnv();

  if (env.WHATSAPP_DRY_RUN === "true") {
    // Dev only (refused in production by lib/env.server.ts). The e2e test reads this line.
    console.info(`[whatsapp:dry-run] OTP for ******${toE164.slice(-4)}: ${code}`);
    return { status: "dry_run" };
  }

  const phoneNumberId = env.WHATSAPP_PHONE_NUMBER_ID;
  const token = env.WHATSAPP_ACCESS_TOKEN;
  const template = env.WHATSAPP_OTP_TEMPLATE_NAME;
  if (!phoneNumberId || !token || !template) {
    return { status: "failed", error: "WhatsApp is not configured" };
  }

  try {
    const res = await fetch(`${GRAPH_API}/${phoneNumberId}/messages`, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify(
        buildOtpTemplatePayload({
          toE164,
          code,
          template,
          language: env.WHATSAPP_OTP_TEMPLATE_LANG,
        }),
      ),
      signal: AbortSignal.timeout(8000),
    });

    const body: unknown = await res.json().catch(() => null);
    if (!res.ok) {
      return { status: "failed", error: describeGraphError(res.status, body) };
    }
    const messageId =
      (body as { messages?: { id?: string }[] } | null)?.messages?.[0]?.id ?? null;
    return { status: "sent", messageId };
  } catch (err) {
    return { status: "failed", error: err instanceof Error ? err.name : "unknown error" };
  }
}

// Keeps only Meta's error code and title; never the request (which holds the OTP and number).
function describeGraphError(status: number, body: unknown): string {
  const error = (body as { error?: { code?: number; error_subcode?: number; message?: string } } | null)
    ?.error;
  return `HTTP ${status}${error?.code ? ` code ${error.code}` : ""}${
    error?.error_subcode ? `/${error.error_subcode}` : ""
  }${error?.message ? `: ${error.message.slice(0, 200)}` : ""}`;
}
