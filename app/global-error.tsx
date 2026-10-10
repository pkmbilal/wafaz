"use client";

import * as Sentry from "@sentry/nextjs";
import { useEffect } from "react";
import "./globals.css";

// Replaces the root layout when it fails, so it renders its own document.
export default function GlobalError({ error, retry }: { error: Error & { digest?: string }; retry: () => void }) {
  useEffect(() => {
    Sentry.captureException(error);
  }, [error]);

  return (
    <html lang="en">
      <body className="flex min-h-screen items-center justify-center bg-background px-4 text-foreground">
        <title>Something went wrong</title>
        <main role="alert" className="flex max-w-sm flex-col items-center gap-3 text-center">
          <h1 className="text-2xl font-semibold">Something went wrong</h1>
          <p className="text-sm text-muted-foreground">Please try again in a moment.</p>
          <button
            type="button"
            onClick={() => retry()}
            className="min-h-11 rounded-md border border-border px-5 text-sm font-medium"
          >
            Try again
          </button>
        </main>
      </body>
    </html>
  );
}
