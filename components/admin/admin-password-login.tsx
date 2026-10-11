"use client";

import { useId, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Turnstile, type TurnstileHandle } from "@/components/store/turnstile";
import { finishAdminLogin, prepareAdminLogin } from "@/app/admin/login/actions";
import { authErrorMessage } from "@/lib/auth/errors";
import { createClient } from "@/lib/supabase/browser";
import { emailSchema } from "@/lib/validators/auth";

const INVALID_LOGIN = "Invalid email or password.";

export function AdminPasswordLogin() {
  const router = useRouter();
  const ids = useId();
  const turnstile = useRef<TurnstileHandle>(null);

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [captchaToken, setCaptchaToken] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState("");

  async function signIn() {
    setError(null);
    const parsed = emailSchema.safeParse(email);
    if (!parsed.success || password.length === 0 || password.length > 128) {
      setError(INVALID_LOGIN);
      return;
    }
    if (!captchaToken) {
      setError("Please wait for the security check to finish.");
      return;
    }

    setPending(true);
    try {
      const allowed = await prepareAdminLogin({ email: parsed.data });
      if (!allowed.ok) {
        setError(allowed.error);
        return;
      }

      const supabase = createClient();
      const { error: signInError } = await supabase.auth.signInWithPassword({
        email: parsed.data,
        password,
        options: { captchaToken },
      });
      turnstile.current?.reset();
      if (signInError) {
        // Same message for unknown email and wrong password, so the form doesn't reveal accounts.
        setError(
          signInError.code === "invalid_credentials" ? INVALID_LOGIN : authErrorMessage(signInError),
        );
        return;
      }

      const result = await finishAdminLogin();
      if (!result.ok) {
        setError(result.error);
        return;
      }
      setStatus("Signed in. Taking you to the dashboard…");
      router.replace("/admin");
      router.refresh();
    } catch {
      setError("Something went wrong. Please try again.");
    } finally {
      setPending(false);
    }
  }

  const errorId = `${ids}-error`;

  return (
    <div>
      <p aria-live="polite" role="status" className="sr-only">
        {status}
      </p>
      <Turnstile ref={turnstile} onToken={setCaptchaToken} action="admin-login" />

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
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            aria-invalid={error ? true : undefined}
            aria-describedby={error ? errorId : undefined}
          />
        </div>
        <div className="flex flex-col gap-2">
          <Label htmlFor={`${ids}-password`}>Password</Label>
          <Input
            id={`${ids}-password`}
            type="password"
            autoComplete="current-password"
            maxLength={128}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            aria-invalid={error ? true : undefined}
            aria-describedby={error ? errorId : undefined}
          />
        </div>

        <div aria-live="assertive" className="empty:hidden">
          {error && (
            <p id={errorId} className="rounded-md bg-destructive/8 px-3 py-2 text-sm text-destructive">
              {error}
            </p>
          )}
        </div>

        <Button type="submit" size="lg" disabled={pending}>
          {pending ? "Signing in…" : "Sign in"}
        </Button>
      </form>
    </div>
  );
}
