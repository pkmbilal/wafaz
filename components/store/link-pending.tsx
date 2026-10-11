"use client";

import { useLinkStatus } from "next/link";
import { Loader2 } from "lucide-react";
import { cn } from "cn";

// Wraps a link's icon and swaps it for a spinner while the link is navigating. For links to
// always-dynamic routes (account), which can't be prefetched, so the click would otherwise
// show nothing until the server responds. Must be rendered inside a <Link>.
export function LinkPending({ children }: { children: React.ReactNode }) {
  const { pending } = useLinkStatus();

  return (
    <span className="relative inline-flex items-center justify-center">
      <span className={cn("inline-flex transition-opacity", pending && "opacity-0")}>{children}</span>
      <Loader2
        aria-hidden
        className={cn(
          "absolute size-5 animate-spin opacity-0 transition-opacity motion-reduce:animate-none",
          pending && "opacity-100",
        )}
      />
      {pending && <span className="sr-only">Loading…</span>}
    </span>
  );
}
