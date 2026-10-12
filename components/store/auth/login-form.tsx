"use client";

import { useId, useRef, useState } from "react";
import Link from "next/link";
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
import { INVALID_LOGIN, authErrorMessage } from "@/lib/auth/errors";
import { createClient } from "@/lib/supabase/browser";
import { loginSchema } from "@/lib/validators/auth";

export function LoginForm({ next }: { next?: string }) {
  const ids = useId();
  const turnstile = useRef<TurnstileHandle>(null);
  const completeSignIn = useCompleteSignIn(next);

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [captchaToken, setCaptchaToken] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState("");
  // Set when the account exists but its email was never confirmed.
  const [unconfirmed, setUnconfirmed] = useState<string | null>(null);

  async function signIn() {
    setError(null);
    const parsed = loginSchema.safeParse({ email, password });
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? INVALID_LOGIN);
      return;
    }
    if (!captchaToken) {
      setError(CAPTCHA_PENDING);
      return;
    }

    setPending(true);
    try {
      const allowed = await prepareAuthRequest({ kind: "login", email: parsed.data.email });
      if (!allowed.ok) {
        setError(allowed.error);
        return;
      }

      const guestToken = await guestAccessToken();
      const { error: signInError } = await createClient().auth.signInWithPassword({
        email: parsed.data.email,
        password: parsed.data.password,
        options: { captchaToken },
      });
      turnstile.current?.reset();
      if (signInError) {
        if (signInError.code === "email_not_confirmed") {
          setUnconfirmed(parsed.data.email);
          return;
        }
        // Same message for an unknown email and a wrong password, so the form doesn't reveal accounts.
        setError(authErrorMessage(signInError));
        return;
      }

      setStatus("Signed in. Taking you there…");
      const finishError = await completeSignIn(guestToken);
      if (finishError) setError(finishError);
    } catch {
      setError(GENERIC_ERROR);
    } finally {
      setPending(false);
    }
  }

  async function sendConfirmation(): Promise<string | null> {
    if (!unconfirmed) return GENERIC_ERROR;
    if (!captchaToken) return CAPTCHA_PENDING;
    const allowed = await prepareAuthRequest({ kind: "email", email: unconfirmed });
    if (!allowed.ok) return allowed.error;
    const { error: resendError } = await createClient().auth.resend({
      type: "signup",
      email: unconfirmed,
      options: { captchaToken },
    });
    turnstile.current?.reset();
    return resendError ? authErrorMessage(resendError) : null;
  }

  async function confirm(code: string): Promise<string | null> {
    if (!unconfirmed) return GENERIC_ERROR;
    const guestToken = await guestAccessToken();
    const { error: verifyError } = await createClient().auth.verifyOtp({
      email: unconfirmed,
      token: code,
      type: "email",
    });
    if (verifyError) return authErrorMessage(verifyError);
    setStatus("Email confirmed. Taking you there…");
    return completeSignIn(guestToken);
  }

  const errorId = `${ids}-error`;

  return (
    <div>
      <LiveStatus message={status} />
      {/* Stays mounted across steps so "Send code" has a fresh token. */}
      <Turnstile ref={turnstile} onToken={setCaptchaToken} action="login" />

      {unconfirmed ? (
        <EmailCodeStep
          email={unconfirmed}
          codeSent={false}
          intro={
            <>
              Your email <span className="font-medium text-foreground">{unconfirmed}</span>{" "}
              isn&apos;t confirmed yet. Send yourself a code to finish setting up your account.
            </>
          }
          submitLabel="Confirm and sign in"
          onVerify={confirm}
          onResend={sendConfirmation}
          onBack={() => {
            setUnconfirmed(null);
            setPassword("");
          }}
          backLabel="Back to sign in"
        />
      ) : (
        <form
          noValidate
          onSubmit={(e) => {
            e.preventDefault();
            void signIn();
          }}
          className="flex flex-col gap-5"
        >
          <div className="flex flex-col gap-2">
            <Label htmlFor={`${ids}-email`}>Email address</Label>
            <Input
              id={`${ids}-email`}
              type="email"
              inputMode="email"
              autoComplete="username"
              placeholder="you@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              aria-invalid={error ? true : undefined}
              aria-describedby={error ? errorId : undefined}
            />
          </div>
          <div className="flex flex-col gap-2">
            <div className="flex items-center justify-between gap-2">
              <Label htmlFor={`${ids}-password`}>Password</Label>
              <Link
                href={next ? `/forgot-password?next=${encodeURIComponent(next)}` : "/forgot-password"}
                className="inline-flex min-h-touch items-center text-sm text-primary underline-offset-4 hover:underline"
              >
                Forgot password?
              </Link>
            </div>
            <PasswordInput
              id={`${ids}-password`}
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              aria-invalid={error ? true : undefined}
              aria-describedby={error ? errorId : undefined}
            />
          </div>

          <FormError id={errorId} message={error} />

          <Button type="submit" size="lg" disabled={pending}>
            {pending ? "Signing in…" : "Sign in"}
          </Button>
        </form>
      )}
    </div>
  );
}
