import "server-only";
import * as Sentry from "@sentry/nextjs";

// Server-side failure reporting. Every webhook and auth-hook failure is also recorded in the DB
// (AGENTS.md §5.12); this sends it to Sentry as well. Without SENTRY_DSN the SDK is a no-op.
// `area` groups issues in Sentry; `context` must not contain PII (it is redacted anyway).
export function reportError(
  area: string,
  error: unknown,
  context: Record<string, string | number | null | undefined> = {},
) {
  const err = error instanceof Error ? error : new Error(describe(error));
  Sentry.captureException(err, { tags: { area }, extra: context });
}

function describe(error: unknown): string {
  if (typeof error === "string") return error;
  if (error && typeof error === "object") {
    const { code, message } = error as { code?: unknown; message?: unknown };
    if (typeof message === "string") return typeof code === "string" ? `${code}: ${message}` : message;
  }
  return "unknown error";
}
