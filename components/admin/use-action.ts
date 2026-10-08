"use client";

import { useTransition } from "react";
import { toast } from "sonner";
import type { ActionResult } from "@/lib/admin-actions";

// Runs an admin Server Action in a transition and reports the outcome as a toast.
export function useAction() {
  const [pending, startTransition] = useTransition();
  // Actions that redirect on success (create, delete) may resolve without a result.
  function run(action: () => Promise<ActionResult | undefined>, success?: string, onDone?: () => void) {
    startTransition(async () => {
      const result = await action();
      if (!result) return;
      if (result.ok) {
        const message = result.message ?? success;
        if (message) toast.success(message);
        onDone?.();
      } else {
        toast.error(result.error);
      }
    });
  }
  return { pending, run };
}
