"use client";

import { useId, useState } from "react";
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
import { EmailCodeStep } from "@/components/store/auth/email-code-step";
import { FormError, GENERIC_ERROR, PasswordInput } from "@/components/store/auth/shared";
import { prepareAuthRequest } from "@/app/(store)/login/actions";
import { authErrorMessage } from "@/lib/auth/errors";
import { createClient } from "@/lib/supabase/browser";
import { emailSchema, newPasswordSchema } from "@/lib/validators/auth";

// Sign-in email: changing it emails a 6-digit code to the new address (email_change).
export function EmailRow({ email }: { email: string | null }) {
  const [open, setOpen] = useState(false);

  return (
    <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1 py-3">
      <div className="min-w-0">
        <p className="text-sm font-medium">Email</p>
        <p className="truncate text-sm text-muted-foreground">{email ?? "Not added"}</p>
      </div>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogTrigger asChild>
          <Button variant="outline" size="sm">
            Change
          </Button>
        </DialogTrigger>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Change email</DialogTitle>
            <DialogDescription>
              We&apos;ll send a code to the new address. You&apos;ll sign in with it from then on.
            </DialogDescription>
          </DialogHeader>
          <ChangeEmail
            onDone={() => {
              setOpen(false);
              toast.success("Email updated");
            }}
          />
        </DialogContent>
      </Dialog>
    </div>
  );
}

function ChangeEmail({ onDone }: { onDone: () => void }) {
  const router = useRouter();
  const ids = useId();
  const [email, setEmail] = useState("");
  const [sentTo, setSentTo] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function sendCode(address: string): Promise<string | null> {
    const allowed = await prepareAuthRequest({ kind: "email", email: address });
    if (!allowed.ok) return allowed.error;
    const { error: updateError } = await createClient().auth.updateUser({ email: address });
    return updateError ? authErrorMessage(updateError) : null;
  }

  async function submit() {
    setError(null);
    const parsed = emailSchema.safeParse(email);
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? "Enter a valid email address");
      return;
    }
    setPending(true);
    try {
      const err = await sendCode(parsed.data);
      if (err) setError(err);
      else setSentTo(parsed.data);
    } catch {
      setError(GENERIC_ERROR);
    } finally {
      setPending(false);
    }
  }

  async function verify(code: string): Promise<string | null> {
    if (!sentTo) return GENERIC_ERROR;
    const { error: verifyError } = await createClient().auth.verifyOtp({
      email: sentTo,
      token: code,
      type: "email_change",
    });
    if (verifyError) return authErrorMessage(verifyError);
    onDone();
    router.refresh();
    return null;
  }

  if (sentTo) {
    return (
      <EmailCodeStep
        email={sentTo}
        intro={
          <>
            Enter the code sent to <span className="font-medium text-foreground">{sentTo}</span>.
          </>
        }
        submitLabel="Confirm"
        onVerify={verify}
        onResend={() => sendCode(sentTo)}
        onBack={() => setSentTo(null)}
      />
    );
  }

  const errorId = `${ids}-error`;
  return (
    <form
      noValidate
      onSubmit={(e) => {
        e.preventDefault();
        void submit();
      }}
      className="flex flex-col gap-5"
    >
      <div className="flex flex-col gap-2">
        <Label htmlFor={`${ids}-email`}>New email address</Label>
        <Input
          id={`${ids}-email`}
          type="email"
          inputMode="email"
          autoComplete="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? errorId : undefined}
        />
      </div>
      <FormError id={errorId} message={error} />
      <Button type="submit" size="lg" disabled={pending}>
        {pending ? "Sending…" : "Send code"}
      </Button>
    </form>
  );
}

export function ChangePasswordForm({ email }: { email: string | null }) {
  const ids = useId();
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit() {
    setError(null);
    const parsed = newPasswordSchema.safeParse({ password, confirmPassword });
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? "Check your password");
      return;
    }
    setPending(true);
    try {
      // TODO(owner): ask for the current password too? Needs Supabase "secure password change".
      const { error: updateError } = await createClient().auth.updateUser({
        password: parsed.data.password,
      });
      if (updateError) {
        setError(authErrorMessage(updateError));
        return;
      }
      setPassword("");
      setConfirmPassword("");
      toast.success("Password updated");
    } catch {
      setError(GENERIC_ERROR);
    } finally {
      setPending(false);
    }
  }

  const errorId = `${ids}-error`;
  return (
    <form
      noValidate
      onSubmit={(e) => {
        e.preventDefault();
        void submit();
      }}
      className="flex flex-col gap-4"
    >
      {/* Lets password managers update the saved password for this account. */}
      <input type="email" autoComplete="username" value={email ?? ""} readOnly hidden />
      <div className="flex flex-col gap-2">
        <Label htmlFor={`${ids}-password`}>New password</Label>
        <PasswordInput
          id={`${ids}-password`}
          autoComplete="new-password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? errorId : undefined}
        />
        <p className="text-xs text-muted-foreground">At least 8 characters.</p>
      </div>
      <div className="flex flex-col gap-2">
        <Label htmlFor={`${ids}-confirm`}>Confirm new password</Label>
        <PasswordInput
          id={`${ids}-confirm`}
          autoComplete="new-password"
          value={confirmPassword}
          onChange={(e) => setConfirmPassword(e.target.value)}
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? errorId : undefined}
        />
      </div>
      <FormError id={errorId} message={error} />
      <Button
        type="submit"
        variant="outline"
        className="self-start"
        disabled={pending || password.length === 0}
      >
        {pending ? "Saving…" : "Update password"}
      </Button>
    </form>
  );
}
