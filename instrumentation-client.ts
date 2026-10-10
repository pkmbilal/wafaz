import * as Sentry from "@sentry/nextjs";
import { scrubBreadcrumb, scrubEvent, sentryDataCollection } from "@/lib/sentry-scrub";

// Browser SDK. No DSN = SDK disabled. No session replay: it would record addresses and phone numbers.
Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN || undefined,
  environment: process.env.NEXT_PUBLIC_VERCEL_ENV ?? process.env.NODE_ENV,
  dataCollection: sentryDataCollection,
  tracesSampleRate: 0.1,
  beforeSend: (event) => scrubEvent(event),
  beforeSendTransaction: (event) => scrubEvent(event),
  beforeBreadcrumb: (crumb) => scrubBreadcrumb(crumb),
});

export const onRouterTransitionStart = Sentry.captureRouterTransitionStart;
