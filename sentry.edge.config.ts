import * as Sentry from "@sentry/nextjs";
import { scrubBreadcrumb, scrubEvent, sentryDataCollection } from "@/lib/sentry-scrub";

// Edge runtime (proxy.ts). Loaded from instrumentation.ts. No DSN = SDK disabled.
Sentry.init({
  dsn: process.env.SENTRY_DSN || undefined,
  environment: process.env.VERCEL_ENV ?? process.env.NODE_ENV,
  dataCollection: sentryDataCollection,
  tracesSampleRate: 0.1,
  beforeSend: (event) => scrubEvent(event),
  beforeSendTransaction: (event) => scrubEvent(event),
  beforeBreadcrumb: (crumb) => scrubBreadcrumb(crumb),
});
