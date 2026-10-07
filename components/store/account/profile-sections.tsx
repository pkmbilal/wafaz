"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { OtpLogin } from "@/components/store/otp-login";
import {
  cancelAccountDeletion,
  requestAccountDeletion,
  setMarketingConsent,
  updateProfile,
  type ActionResult,
} from "@/app/(store)/account/actions";
import { signOut } from "@/app/(store)/login/actions";
import type { OtpChannel } from "@/lib/validators/auth";

function useAction() {
  const [pending, startTransition] = useTransition();
  function run(action: () => Promise<ActionResult>, success?: string) {
    startTransition(async () => {
      const result = await action();
      if (result.ok) {
        if (success) toast.success(success);
      } else {
        toast.error(result.error);
      }
    });
  }
  return { pending, run };
}

export function NameForm({ fullName }: { fullName: string | null }) {
  const [value, setValue] = useState(fullName ?? "");
  const { pending, run } = useAction();

  return (
    <form
      className="flex flex-col gap-2"
      onSubmit={(e) => {
        e.preventDefault();
        run(() => updateProfile({ fullName: value }), "Name saved");
      }}
    >
      <Label htmlFor="account-name">Full name</Label>
      <div className="flex flex-col gap-2 sm:flex-row">
        <Input
          id="account-name"
          autoComplete="name"
          maxLength={120}
          value={value}
          onChange={(e) => setValue(e.target.value)}
        />
        <Button type="submit" variant="outline" disabled={pending || value.trim() === (fullName ?? "")}>
          {pending ? "Saving…" : "Save"}
        </Button>
      </div>
    </form>
  );
}

export function ContactRow({
  channel,
  value,
}: {
  channel: OtpChannel;
  value: string | null;
}) {
  const [open, setOpen] = useState(false);
  const label = channel === "whatsapp" ? "WhatsApp number" : "Email";

  return (
    <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1 py-3">
      <div className="min-w-0">
        <p className="text-sm font-medium">{label}</p>
        <p className="truncate text-sm text-muted-foreground">{value ?? "Not added"}</p>
      </div>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogTrigger asChild>
          <Button variant="outline" size="sm">
            {value ? "Change" : "Add"}
          </Button>
        </DialogTrigger>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{value ? `Change ${label.toLowerCase()}` : `Add ${label.toLowerCase()}`}</DialogTitle>
            <DialogDescription>
              We&apos;ll send a code to confirm it. You can then sign in with it too.
            </DialogDescription>
          </DialogHeader>
          <OtpLogin
            mode="change"
            defaultChannel={channel}
            channels={[channel]}
            onDone={() => {
              setOpen(false);
              toast.success(`${label} saved`);
            }}
          />
        </DialogContent>
      </Dialog>
    </div>
  );
}

export function MarketingConsent({ consent }: { consent: boolean }) {
  const [checked, setChecked] = useState(consent);
  const { pending, run } = useAction();

  return (
    <div className="flex items-start justify-between gap-4">
      <div className="flex flex-col gap-1">
        <Label htmlFor="marketing-consent">Offers and new arrivals</Label>
        <p id="marketing-consent-help" className="text-sm text-muted-foreground">
          Occasional offers by email or WhatsApp. Order updates are always sent, whatever you
          choose here.
        </p>
      </div>
      <Switch
        id="marketing-consent"
        aria-describedby="marketing-consent-help"
        checked={checked}
        disabled={pending}
        onCheckedChange={(next) => {
          setChecked(next);
          run(
            () => setMarketingConsent({ consent: next }),
            next ? "You'll hear about offers" : "Marketing messages turned off",
          );
        }}
      />
    </div>
  );
}

export function AccountDeletion({ requestedAt }: { requestedAt: string | null }) {
  const [open, setOpen] = useState(false);
  const { pending, run } = useAction();

  if (requestedAt) {
    return (
      <div className="flex flex-col gap-3">
        <p className="text-sm text-foreground/80">
          You asked us to delete your account on{" "}
          {new Intl.DateTimeFormat("en-IN", { dateStyle: "long", timeZone: "Asia/Kolkata" }).format(
            new Date(requestedAt),
          )}
          . We&apos;ll be in touch to confirm.
        </p>
        <Button
          variant="outline"
          className="self-start"
          disabled={pending}
          onClick={() => run(cancelAccountDeletion, "Deletion request withdrawn")}
        >
          Withdraw request
        </Button>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      <p className="text-sm text-muted-foreground">
        We&apos;ll delete your profile and saved addresses. Orders and invoices are kept as
        required for tax records.
      </p>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogTrigger asChild>
          <Button variant="destructive" className="self-start">
            Request account deletion
          </Button>
        </DialogTrigger>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete your account?</DialogTitle>
            <DialogDescription>
              We&apos;ll process your request and confirm by email. Orders and invoices are kept
              for tax records.
            </DialogDescription>
          </DialogHeader>
          <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <Button variant="ghost" onClick={() => setOpen(false)}>
              Keep my account
            </Button>
            <Button
              variant="destructive"
              disabled={pending}
              onClick={() =>
                run(async () => {
                  const result = await requestAccountDeletion();
                  if (result.ok) setOpen(false);
                  return result;
                }, "Deletion requested")
              }
            >
              Request deletion
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

export function SignOutButton() {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  return (
    <Button
      variant="outline"
      disabled={pending}
      onClick={() =>
        startTransition(async () => {
          await signOut();
          router.replace("/");
          router.refresh();
        })
      }
    >
      {pending ? "Signing out…" : "Sign out"}
    </Button>
  );
}
