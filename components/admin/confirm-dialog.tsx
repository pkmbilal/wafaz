"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { useAction } from "@/components/admin/use-action";
import type { ActionResult } from "@/lib/admin-actions";

type ButtonProps = React.ComponentProps<typeof Button>;

// A button that asks before running an admin action (delete, publish, status changes).
export function ConfirmDialog({
  trigger,
  triggerLabel,
  title,
  description,
  confirm,
  onConfirm,
  success,
  variant = "default",
  size = "default",
  confirmVariant = "default",
}: {
  trigger: React.ReactNode;
  // Accessible name when the trigger is icon-only.
  triggerLabel?: string;
  title: string;
  description: string;
  confirm: string;
  onConfirm: () => Promise<ActionResult>;
  success?: string;
  variant?: ButtonProps["variant"];
  size?: ButtonProps["size"];
  confirmVariant?: ButtonProps["variant"];
}) {
  const [open, setOpen] = useState(false);
  const { pending, run } = useAction();
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant={variant} size={size} aria-label={triggerLabel}>
          {trigger}
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button
            variant={confirmVariant}
            disabled={pending}
            onClick={() => run(onConfirm, success, () => setOpen(false))}
          >
            {pending ? "Saving…" : confirm}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
