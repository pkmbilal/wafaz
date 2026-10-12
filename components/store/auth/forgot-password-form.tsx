"use client";

import { useId, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Turnstile, type TurnstileHandle } from "@/components/store/turnstile";
import { EmailCodeStep } from "@/components/store/auth/email-code-step";
import {
  CAPTCHA_PENDING,
  FormError,
  GENERIC_ERROR,
  LiveStatus,
  PasswordInput,
  guestAccessToken,
  useCompleteSignIn,
} from "@/components/store/auth/shared";
import { prepareAuthRequest } from "@/app/(store)/login/actions";
import { authErrorMessage } from "@/lib/auth/errors";
import { createClient } from "@/lib/supabase/browser";
import { emailSchema, newPasswordSchema } from "@/lib/validators/auth";

// Email → 6-digit recovery code (which signs the customer in) → new password.
export function ForgotPasswordForm({ next }: { next?: string }) {
  const ids = useId();
  const turnstile = useRef<TurnstileHandle>(null);
  const completeSignIn = useCompleteSignIn(next);

  const [step, setStep] = useState<"email" | "code" | "password">("email");
  const [email, setEmail] = useState("");
  const [sentTo, setSentTo] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [captchaToken, setCaptchaToken] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState("");
  // Guest session held before the recovery code signed the customer in, for the merge.
  const guestToken = useRef<string | undefined>(undefined);

  async function sendReset(address: string): Promise<string | null> {
    if (!captchaToken) return CAPTCHA_PENDING;
    const allowed = await prepareAuthRequest({ kind: "email", email: address });
    if (!allowed.ok) return allowed.error;
    const { error: resetError } = await createClient().auth.resetPasswordForEmail(address, {
      captchaToken,
    });
    turnstile.current?.reset();
    return resetError ? authErrorMessage(resetError) : null;
  }

  async function requestCode() {
    setError(null);
    const parsed = emailSchema.safeParse(email);
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? "Enter a valid email address");
      return;
    }
    setPending(true);
    try {
      const err = await sendReset(parsed.data);
      if (err) {
        setError(err);
        return;
      }
      setSentTo(parsed.data);
      setStep("code");
      setStatus(`If an account exists for ${parsed.data}, we've sent it a code.`);
    } catch {
      setError(GENERIC_ERROR);
    } finally {
      setPending(false);
    }
  }

  async function verify(code: string): Promise<string | null> {
    guestToken.current = await guestAccessToken();
    const { error: verifyError } = await createClient().auth.verifyOtp({
      email: sentTo,
      token: code,
      type: "recovery",
    });
    if (verifyError) return authErrorMessage(verifyError);
    setStep("password");
    setStatus("Code accepted. Choose a new password.");
    return null;
  }

  async function savePassword() {
    setError(null);
    const parsed = newPasswordSchema.safeParse({ password, confirmPassword });
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? "Check your password");
      return;
    }
    setPending(true);
    try {
      const { error: updateError } = await createClient().auth.updateUser({
        password: parsed.data.password,
      });
      if (updateError) {
        setError(authErrorMessage(updateError));
        return;
      }
      setStatus("Password updated. Taking you there…");
      const finishError = await completeSignIn(guestToken.current);
      if (finishError) setError(finishError);
    } catch {
      setError(GENERIC_ERROR);
    } finally {
      setPending(false);
    }
  }

  const errorId = `${ids}-error`;

  return (
    <div>
      <LiveStatus message={status} />
      <Turnstile ref={turnstile} onToken={setCaptchaToken} action="password-reset" />

      {step === "email" && (
        <form
          noValidate
          onSubmit={(e) => {
            e.preventDefault();
            void requestCode();
          }}
          className="flex flex-col gap-5"
        >
          <div className="flex flex-col gap-2">
            <Label htmlFor={`${ids}-email`}>Email address</Label>
            <Input
              id={`${ids}-email`}
              type="email"
              inputMode="email"
              autoComplete="email"
              placeholder="you@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              aria-invalid={error ? true : undefined}
              aria-describedby={error ? errorId : undefined}
            />
            <p className="text-xs text-muted-foreground">
              We&apos;ll email you a 6-digit code to reset your password.
            </p>
          </div>
          <FormError id={errorId} message={error} />
          <Button type="submit" size="lg" disabled={pending}>
            {pending ? "Sending…" : "Send code"}
          </Button>
        </form>
      )}

      {step === "code" && (
        <EmailCodeStep
          email={sentTo}
          intro={
            <>
              If an account exists for <span className="font-medium text-foreground">{sentTo}</span>,
              we&apos;ve sent it a 6-digit code.
            </>
          }
          submitLabel="Continue"
          onVerify={verify}
          onResend={() => sendReset(sentTo)}
          onBack={() => setStep("email")}
        />
      )}

      {step === "password" && (
        <form
          noValidate
          onSubmit={(e) => {
            e.preventDefault();
            void savePassword();
          }}
          className="flex flex-col gap-5"
        >
          {/* Lets password managers save the new password against the right account. */}
          <input type="email" autoComplete="username" value={sentTo} readOnly hidden />
          <div className="flex flex-col gap-2">
            <Label htmlFor={`${ids}-password`}>New password</Label>
            <PasswordInput
              id={`${ids}-password`}
              autoComplete="new-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              aria-invalid={error ? true : undefined}
              aria-describedby={error ? errorId : undefined}
              autoFocus
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
          <Button type="submit" size="lg" disabled={pending}>
            {pending ? "Saving…" : "Save password and sign in"}
          </Button>
        </form>
      )}
    </div>
  );
}
