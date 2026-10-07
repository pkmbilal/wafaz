import { createHash } from "node:crypto";

// sha256 hex of a phone number, email or IP, so logs and rate-limit keys hold no raw PII.
export function hashIdentifier(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}

// Client IP from proxy headers. On Vercel the left-most x-forwarded-for entry is the client.
export function clientIp(headers: Pick<Headers, "get">): string {
  const forwarded = headers.get("x-forwarded-for")?.split(",")[0]?.trim();
  return forwarded || headers.get("x-real-ip")?.trim() || "unknown";
}
