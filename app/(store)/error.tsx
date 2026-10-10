"use client";

import * as Sentry from "@sentry/nextjs";
import { CloudOff } from "lucide-react";
import { useEffect } from "react";
import { Button } from "@/components/ui/button";

// Store error boundary. Server-side errors are already reported by instrumentation.ts;
// this catches client render errors.
export default function StoreError({ error, retry }: { error: Error & { digest?: string }; retry: () => void }) {
  useEffect(() => {
    Sentry.captureException(error);
  }, [error]);

  return (
    <div className="mx-auto w-full max-w-3xl px-4 py-16">
      <div
        role="alert"
        className="flex flex-col items-center gap-3 rounded-lg border border-dashed border-border px-6 py-16 text-center"
      >
        <CloudOff aria-hidden className="size-10 text-accent" strokeWidth={1.5} />
        <h2 className="text-2xl font-semibold">Something went wrong</h2>
        <p className="max-w-sm text-sm text-muted-foreground">
          Please try again. If you were paying, your payment is safe: check your email for confirmation.
        </p>
        <Button variant="outline" className="mt-2" onClick={() => retry()}>
          Try again
        </Button>
        {error.digest && <p className="text-xs text-muted-foreground">Reference: {error.digest}</p>}
      </div>
    </div>
  );
}
