"use client";

import { useId, useState } from "react";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { InputOTP, InputOTPGroup, InputOTPSlot } from "@/components/ui/input-otp";
import { Label } from "@/components/ui/label";
import { FormError, GENERIC_ERROR, RESEND_SECONDS, useCooldown } from "@/components/store/auth/shared";

type Props = {
  email: string;
  // Shown above the code input, e.g. "We've sent a 6-digit code to …".
  intro: React.ReactNode;
  submitLabel: string;
  // Each returns an error message, or null on success.
  onVerify: (code: string) => Promise<string | null>;
  onResend: () => Promise<string | null>;
  onBack?: () => void;
  backLabel?: string;
  // False when no code has been sent yet (an unconfirmed account trying to log in).
  codeSent?: boolean;
};

// The 6-digit email code step shared by sign-up, password reset and email change.
export function EmailCodeStep({
  email,
  intro,
  submitLabel,
  onVerify,
  onResend,
  onBack,
  backLabel = "Use a different email",
  codeSent = true,
}: Props) {
  const ids = useId();
  const [code, setCode] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState("");
  const [cooldown, setCooldown] = useCooldown(codeSent ? RESEND_SECONDS : 0);
  const [sent, setSent] = useState(codeSent);

  async function verify(value = code) {
    if (!/^\d{6}$/.test(value)) {
      setError("Enter the 6-digit code");
      return;
    }
    setError(null);
    setPending(true);
    try {
      const err = await onVerify(value);
      if (err) setError(err);
    } catch {
      setError(GENERIC_ERROR);
    } finally {
      setPending(false);
    }
  }

  async function resend() {
    setError(null);
    setPending(true);
    try {
      const err = await onResend();
      if (err) {
        setError(err);
        return;
      }
      setCode("");
      setSent(true);
      setCooldown(RESEND_SECONDS);
      setNotice(`We've sent a new code to ${email}.`);
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
        void verify();
      }}
      className="flex flex-col gap-5"
    >
      <div className="flex flex-col gap-1">
        <div className="text-sm text-foreground/80">{intro}</div>
        {notice && (
          <p aria-live="polite" className="text-sm text-muted-foreground">
            {notice}
          </p>
        )}
        {onBack && (
          <Button
            type="button"
            variant="link"
            className="h-auto min-h-touch self-start px-0"
            onClick={onBack}
          >
            <ArrowLeft aria-hidden /> {backLabel}
          </Button>
        )}
      </div>

      <div className="flex flex-col gap-2">
        <Label htmlFor={`${ids}-code`}>6-digit code</Label>
        <InputOTP
          id={`${ids}-code`}
          maxLength={6}
          inputMode="numeric"
          pattern="^\d*$"
          autoComplete="one-time-code"
          value={code}
          onChange={setCode}
          onComplete={(v: string) => void verify(v)}
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? errorId : undefined}
          autoFocus={sent}
        >
          <InputOTPGroup>
            {[0, 1, 2, 3, 4, 5].map((i) => (
              <InputOTPSlot key={i} index={i} aria-invalid={error ? true : undefined} />
            ))}
          </InputOTPGroup>
        </InputOTP>
      </div>

      <FormError id={errorId} message={error} />

      <Button type="submit" size="lg" disabled={pending || code.length !== 6}>
        {pending ? "Checking…" : submitLabel}
      </Button>

      <Button
        type="button"
        variant="ghost"
        disabled={pending || cooldown > 0}
        onClick={() => void resend()}
      >
        {cooldown > 0 ? `Resend code in ${cooldown}s` : sent ? "Resend code" : "Send code"}
      </Button>
    </form>
  );
}
