// PII scrubbing for Sentry (AGENTS.md §5.12). Shared by the client, server and edge SDK configs.
// Sentry events must never carry a customer's phone, email or address, so this:
//  - drops the user's identity except the opaque id,
//  - drops request bodies, cookies, query strings and headers (addresses arrive in form bodies),
//  - drops breadcrumb payloads,
//  - redacts anything shaped like an email or Indian mobile number in the strings that remain.

import type { init } from "@sentry/nextjs";

const EMAIL = /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi;
// +91 / 91 / 0 prefixed or bare 10-digit Indian mobiles, with optional spaces or dashes.
const PHONE = /(?<!\d)(?:\+?91[\s-]?|0)?[6-9]\d{4}[\s-]?\d{5}(?!\d)/g;

// Passed as `dataCollection` to every Sentry.init. The SDK defaults collect cookies, headers, bodies,
// query params, DB query data and stack-frame locals; we turn all of that off and rely on
// beforeSend below as the second layer.
export const sentryDataCollection: NonNullable<Parameters<typeof init>[0]>["dataCollection"] = {
  userInfo: false,
  cookies: false,
  httpHeaders: false,
  httpBodies: [],
  urlQueryParams: false,
  databaseQueryData: false,
  queues: false,
  stackFrameVariables: false,
  genAI: { inputs: false, outputs: false },
  graphQL: { document: false, variables: false },
};

export function redact(value: string): string {
  return value.replace(EMAIL, "[email]").replace(PHONE, "[phone]");
}

// Only the fields this file touches are typed; everything else on the event passes through.
type Breadcrumb = { message?: string; data?: unknown };
type ScrubbableEvent = {
  message?: string;
  user?: { id?: string | number; [key: string]: unknown };
  request?: { url?: string; data?: unknown; cookies?: unknown; headers?: unknown; query_string?: unknown };
  exception?: { values?: { value?: string }[] };
  breadcrumbs?: Breadcrumb[];
  extra?: Record<string, unknown>;
};

export function scrubBreadcrumb<B extends Breadcrumb>(crumb: B): B {
  const out = { ...crumb };
  delete out.data;
  if (out.message) out.message = redact(out.message);
  return out;
}

export function scrubEvent<E extends ScrubbableEvent>(event: E): E {
  const out = { ...event };

  if (out.user) out.user = out.user.id !== undefined ? { id: out.user.id } : undefined;

  if (out.request) {
    // Guest order links carry the HMAC token in ?t=, so the query string goes too.
    out.request = { url: out.request.url ? redact(out.request.url.split("?")[0]) : undefined };
  }

  if (out.message) out.message = redact(out.message);

  if (out.exception?.values) {
    out.exception = {
      ...out.exception,
      values: out.exception.values.map((v) => (v.value ? { ...v, value: redact(v.value) } : v)),
    };
  }

  if (out.breadcrumbs) out.breadcrumbs = out.breadcrumbs.map(scrubBreadcrumb);

  if (out.extra) {
    out.extra = Object.fromEntries(
      Object.entries(out.extra).map(([k, v]) => [k, typeof v === "string" ? redact(v) : v]),
    );
  }

  return out;
}
