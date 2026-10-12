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
import { authErrorMessage } from "@/lib/auth/errors";
import { createClient } from "@/lib/supabase/browser";
import { signupSchema } from "@/lib/validators/auth";

type Field = "fullName" | "email" | "password" | "confirmPassword";

// Sign-up creates a new user and emails a 6-digit confirmation code. A guest's cart and orders
// move to the new account in finishLogin (merge_guest_into_user), as with password sign-in.
export function SignupForm({ next }: { next?: string }) {
  const ids = useId();
  const turnstile = useRef<TurnstileHandle>(null);
  const completeSignIn = useCompleteSignIn(next);

  const [values, setValues] = useState<Record<Field, string>>({
    fullName: "",
    email: "",
    password: "",
    confirmPassword: "",
  });
  const [fieldErrors, setFieldErrors] = useState<Partial<Record<Field, string>>>({});
  const [captchaToken, setCaptchaToken] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [accountExists, setAccountExists] = useState(false);
  const [status, setStatus] = useState("");
  // The email the confirmation code was sent to.
  const [sentTo, setSentTo] = useState<string | null>(null);

  function set(field: Field, value: string) {
    setValues((v) => ({ ...v, [field]: value }));
    setFieldErrors((e) => ({ ...e, [field]: undefined }));
  }

  async function sendSignUp(): Promise<string | null> {
    const parsed = signupSchema.safeParse(values);
    if (!parsed.success) return GENERIC_ERROR;
    if (!captchaToken) return CAPTCHA_PENDING;

    const allowed = await prepareAuthRequest({ kind: "email", email: parsed.data.email });
    if (!allowed.ok) return allowed.error;

    const { data, error: signUpError } = await createClient().auth.signUp({
      email: parsed.data.email,
      password: parsed.data.password,
      options: { captchaToken, data: { full_name: parsed.data.fullName } },
    });
    turnstile.current?.reset();
    if (signUpError) {
      if (signUpError.code === "user_already_exists") setAccountExists(true);
      return authErrorMessage(signUpError);
    }
    // With email confirmations on, Supabase answers an already-confirmed email with a user that
    // has no identities instead of an error, and sends nothing.
    if (data.user && data.user.identities?.length === 0) {
      setAccountExists(true);
      return "An account with this email already exists. Log in instead.";
    }
    return null;
  }

  async function signUp() {
    setError(null);
    setAccountExists(false);
    const parsed = signupSchema.safeParse(values);
    if (!parsed.success) {
      const errors: Partial<Record<Field, string>> = {};
      for (const issue of parsed.error.issues) {
        const field = issue.path[0] as Field;
        errors[field] ??= issue.message;
      }
      setFieldErrors(errors);
      return;
    }

    setPending(true);
    try {
      const err = await sendSignUp();
      if (err) {
        setError(err);
        return;
      }
      setSentTo(parsed.data.email);
      setStatus(`We've sent a 6-digit code to ${parsed.data.email}.`);
    } catch {
      setError(GENERIC_ERROR);
    } finally {
      setPending(false);
    }
  }

  async function resend(): Promise<string | null> {
    if (!sentTo) return GENERIC_ERROR;
    if (!captchaToken) return CAPTCHA_PENDING;
    const allowed = await prepareAuthRequest({ kind: "email", email: sentTo });
    if (!allowed.ok) return allowed.error;
    const { error: resendError } = await createClient().auth.resend({
      type: "signup",
      email: sentTo,
      options: { captchaToken },
    });
    turnstile.current?.reset();
    return resendError ? authErrorMessage(resendError) : null;
  }

  async function confirm(code: string): Promise<string | null> {
    if (!sentTo) return GENERIC_ERROR;
    const guestToken = await guestAccessToken();
    const { error: verifyError } = await createClient().auth.verifyOtp({
      email: sentTo,
      token: code,
      type: "email",
    });
    if (verifyError) return authErrorMessage(verifyError);
    setStatus("Account created. Taking you there…");
    return completeSignIn(guestToken);
  }

  const errorId = `${ids}-error`;
  const loginHref = next ? `/login?next=${encodeURIComponent(next)}` : "/login";

  function fieldProps(field: Field) {
    const message = fieldErrors[field];
    return {
      id: `${ids}-${field}`,
      value: values[field],
      onChange: (e: React.ChangeEvent<HTMLInputElement>) => set(field, e.target.value),
      "aria-invalid": message ? true : undefined,
      "aria-describedby": message ? `${ids}-${field}-error` : undefined,
    };
  }

  function fieldError(field: Field) {
    const message = fieldErrors[field];
    if (!message) return null;
    return (
      <p id={`${ids}-${field}-error`} className="text-sm text-destructive">
        {message}
      </p>
    );
  }

  return (
    <div>
      <LiveStatus message={status} />
      <Turnstile ref={turnstile} onToken={setCaptchaToken} action="signup" />

      {sentTo ? (
        <EmailCodeStep
          email={sentTo}
          intro={
            <>
              We&apos;ve sent a 6-digit code to{" "}
              <span className="font-medium text-foreground">{sentTo}</span>. Enter it to finish
              creating your account.
            </>
          }
          submitLabel="Create account"
          onVerify={confirm}
          onResend={resend}
          onBack={() => setSentTo(null)}
        />
      ) : (
        <form
          noValidate
          onSubmit={(e) => {
            e.preventDefault();
            void signUp();
          }}
          className="flex flex-col gap-5"
        >
          <div className="flex flex-col gap-2">
            <Label htmlFor={`${ids}-fullName`}>Full name</Label>
            <Input autoComplete="name" maxLength={120} {...fieldProps("fullName")} />
            {fieldError("fullName")}
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor={`${ids}-email`}>Email address</Label>
            <Input
              type="email"
              inputMode="email"
              autoComplete="email"
              placeholder="you@example.com"
              {...fieldProps("email")}
            />
            {fieldError("email")}
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor={`${ids}-password`}>Password</Label>
            <PasswordInput autoComplete="new-password" {...fieldProps("password")} />
            {fieldErrors.password ? (
              fieldError("password")
            ) : (
              <p className="text-xs text-muted-foreground">At least 8 characters.</p>
            )}
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor={`${ids}-confirmPassword`}>Confirm password</Label>
            <PasswordInput autoComplete="new-password" {...fieldProps("confirmPassword")} />
            {fieldError("confirmPassword")}
          </div>

          <FormError id={errorId} message={error}>
            {accountExists && (
              <Link
                href={loginHref}
                className="inline-flex min-h-touch items-center text-sm font-medium text-primary underline-offset-4 hover:underline"
              >
                Go to sign in
              </Link>
            )}
          </FormError>

          <Button type="submit" size="lg" disabled={pending}>
            {pending ? "Creating account…" : "Continue"}
          </Button>
        </form>
      )}
    </div>
  );
}
