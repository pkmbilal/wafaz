"use client";

import { useEffect, useId, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { MessageCircle, Mail, ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { InputOTP, InputOTPGroup, InputOTPSlot } from "@/components/ui/input-otp";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useOptionalCart } from "@/components/store/cart-provider";
import { Turnstile, type TurnstileHandle } from "@/components/store/turnstile";
import { finishLogin, prepareOtpRequest } from "@/app/(store)/login/actions";
import { authErrorMessage, isAlreadyLinked } from "@/lib/auth/errors";
import { createClient } from "@/lib/supabase/browser";
import { emailSchema, phoneSchema, type OtpChannel, type OtpFlow } from "@/lib/validators/auth";

const RESEND_SECONDS = 60;

type Props = {
  // "login": sign in (upgrading a guest session when possible).
  // "change": add or change the phone/email on the signed-in account.
  mode?: "login" | "change";
  next?: string;
  defaultChannel?: OtpChannel;
  // Change mode only: limit to one channel.
  channels?: OtpChannel[];
  onDone?: () => void;
};

export function OtpLogin({
  mode = "login",
  next,
  defaultChannel = "whatsapp",
  channels = ["whatsapp", "email"],
  onDone,
}: Props) {
  const router = useRouter();
  const cart = useOptionalCart();
  const ids = useId();
  const turnstile = useRef<TurnstileHandle>(null);

  const [channel, setChannel] = useState<OtpChannel>(defaultChannel);
  const [step, setStep] = useState<"identifier" | "code">("identifier");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [identifier, setIdentifier] = useState(""); // normalised value the code was sent to
  const [flow, setFlow] = useState<OtpFlow>("signin");
  const [code, setCode] = useState("");
  const [captchaToken, setCaptchaToken] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [whatsAppFailed, setWhatsAppFailed] = useState(false);
  const [status, setStatus] = useState("");
  const [cooldown, setCooldown] = useState(0);

  useEffect(() => {
    if (cooldown <= 0) return;
    const t = setTimeout(() => setCooldown((s) => s - 1), 1000);
    return () => clearTimeout(t);
  }, [cooldown]);

  function switchChannel(value: string) {
    setChannel(value as OtpChannel);
    setError(null);
    setWhatsAppFailed(false);
  }

  async function requestCode() {
    setError(null);
    setWhatsAppFailed(false);

    const parsed =
      channel === "whatsapp" ? phoneSchema.safeParse(phone) : emailSchema.safeParse(email);
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? "Check your details");
      return;
    }
    const value = parsed.data;

    setPending(true);
    try {
      const allowed = await prepareOtpRequest({ channel, identifier: value });
      if (!allowed.ok) {
        setError(allowed.error);
        return;
      }

      const supabase = createClient();
      const { data } = await supabase.auth.getSession();
      const isGuest = data.session?.user.is_anonymous === true;
      const contact = channel === "whatsapp" ? { phone: value } : { email: value };

      // Guests and signed-in users keep their uid by adding the contact to their own user.
      let usedFlow: OtpFlow = "signin";
      if (mode === "change" || isGuest) {
        const { error: updateError } = await supabase.auth.updateUser(contact);
        if (!updateError) {
          usedFlow = "change";
        } else if (mode === "change" || !isAlreadyLinked(updateError)) {
          return fail(updateError);
        }
        // Already belongs to an account: sign in to it and merge the guest afterwards.
      }

      if (usedFlow === "signin") {
        if (!captchaToken) {
          setError("Please wait for the security check to finish.");
          return;
        }
        const { error: otpError } = await supabase.auth.signInWithOtp({
          ...contact,
          options: { captchaToken, shouldCreateUser: true },
        });
        turnstile.current?.reset();
        if (otpError) return fail(otpError);
      }

      setIdentifier(value);
      setFlow(usedFlow);
      setCode("");
      setStep("code");
      setCooldown(RESEND_SECONDS);
      setStatus(
        channel === "whatsapp"
          ? `We've sent a 6-digit code to ${value} on WhatsApp.`
          : `We've sent a 6-digit code to ${value}.`,
      );
    } catch {
      setError("Something went wrong. Please try again.");
    } finally {
      setPending(false);
    }
  }

  function fail(err: { code?: string; message?: string; status?: number }) {
    setError(authErrorMessage(err));
    if (channel === "whatsapp" && mode === "login") setWhatsAppFailed(true);
  }

  async function verifyCode(value = code) {
    if (!/^\d{6}$/.test(value)) {
      setError("Enter the 6-digit code");
      return;
    }
    setError(null);
    setPending(true);
    try {
      const supabase = createClient();
      // Captured before verifying: it proves this browser held the guest session (for the merge).
      const { data } = await supabase.auth.getSession();
      const guestAccessToken =
        data.session?.user.is_anonymous === true ? data.session.access_token : undefined;

      const { error: verifyError } =
        channel === "whatsapp"
          ? await supabase.auth.verifyOtp({
              phone: identifier,
              token: value,
              type: flow === "change" ? "phone_change" : "sms",
            })
          : await supabase.auth.verifyOtp({
              email: identifier,
              token: value,
              type: flow === "change" ? "email_change" : "email",
            });
      if (verifyError) {
        setError(authErrorMessage(verifyError));
        return;
      }

      if (mode === "change") {
        setStatus("Saved.");
        onDone?.();
        router.refresh();
        return;
      }

      const result = await finishLogin({
        guestAccessToken: flow === "signin" ? guestAccessToken : undefined,
        next,
      });
      if (!result.ok) {
        setError(result.error);
        return;
      }
      // The guest's cart may have merged into the account's cart.
      void cart?.reload();
      setStatus("Signed in. Taking you there…");
      router.replace(result.redirectTo);
      router.refresh();
    } catch {
      setError("Something went wrong. Please try again.");
    } finally {
      setPending(false);
    }
  }

  function backToIdentifier() {
    setStep("identifier");
    setCode("");
    setError(null);
    setStatus("");
  }

  const errorId = `${ids}-error`;

  return (
    <div>
      <p aria-live="polite" role="status" className="sr-only">
        {status}
      </p>

      {/* Stays mounted across steps so "Resend code" has a fresh token. */}
      <Turnstile ref={turnstile} onToken={setCaptchaToken} action="otp" />

      {step === "identifier" ? (
        <form
          noValidate
          onSubmit={(e) => {
            e.preventDefault();
            void requestCode();
          }}
          className="flex flex-col gap-5"
        >
          <Tabs value={channel} onValueChange={switchChannel}>
            {channels.length > 1 && (
              <TabsList className="w-full">
                <TabsTrigger value="whatsapp">
                  <MessageCircle aria-hidden /> WhatsApp
                </TabsTrigger>
                <TabsTrigger value="email">
                  <Mail aria-hidden /> Email
                </TabsTrigger>
              </TabsList>
            )}

            <TabsContent value="whatsapp" className="mt-3 flex flex-col gap-2">
              <Label htmlFor={`${ids}-phone`}>WhatsApp number</Label>
              <div className="flex items-stretch gap-2">
                <span className="inline-flex min-h-touch items-center rounded-md border border-input bg-muted px-3 text-base text-muted-foreground">
                  +91
                </span>
                <Input
                  id={`${ids}-phone`}
                  type="tel"
                  inputMode="numeric"
                  autoComplete="tel-national"
                  placeholder="98765 43210"
                  maxLength={14}
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  aria-invalid={error ? true : undefined}
                  aria-describedby={error ? errorId : undefined}
                />
              </div>
              <p className="text-xs text-muted-foreground">
                We&apos;ll send a one-time code to this number on WhatsApp.
              </p>
            </TabsContent>

            <TabsContent value="email" className="mt-3 flex flex-col gap-2">
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
              <p className="text-xs text-muted-foreground">We&apos;ll email you a 6-digit code.</p>
            </TabsContent>
          </Tabs>

          <ErrorMessage id={errorId} message={error}>
            {whatsAppFailed && channels.includes("email") && (
              <Button
                type="button"
                variant="link"
                className="h-auto min-h-touch px-0"
                onClick={() => switchChannel("email")}
              >
                Get the code by email instead
              </Button>
            )}
          </ErrorMessage>

          <Button type="submit" size="lg" disabled={pending}>
            {pending ? "Sending…" : "Send code"}
          </Button>
        </form>
      ) : (
        <form
          noValidate
          onSubmit={(e) => {
            e.preventDefault();
            void verifyCode();
          }}
          className="flex flex-col gap-5"
        >
          <div className="flex flex-col gap-1">
            <p className="text-sm text-foreground/80">
              Enter the code sent to <span className="font-medium text-foreground">{identifier}</span>
              {channel === "whatsapp" ? " on WhatsApp" : ""}.
            </p>
            <Button
              type="button"
              variant="link"
              className="h-auto min-h-touch self-start px-0"
              onClick={backToIdentifier}
            >
              <ArrowLeft aria-hidden /> Change {channel === "whatsapp" ? "number" : "email"}
            </Button>
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
              onComplete={(v: string) => void verifyCode(v)}
              aria-invalid={error ? true : undefined}
              aria-describedby={error ? errorId : undefined}
              autoFocus
            >
              <InputOTPGroup>
                {[0, 1, 2, 3, 4, 5].map((i) => (
                  <InputOTPSlot key={i} index={i} aria-invalid={error ? true : undefined} />
                ))}
              </InputOTPGroup>
            </InputOTP>
          </div>

          <ErrorMessage id={errorId} message={error} />

          <Button type="submit" size="lg" disabled={pending || code.length !== 6}>
            {pending ? "Checking…" : mode === "change" ? "Confirm" : "Verify and sign in"}
          </Button>

          <Button
            type="button"
            variant="ghost"
            disabled={pending || cooldown > 0}
            onClick={() => void requestCode()}
          >
            {cooldown > 0 ? `Resend code in ${cooldown}s` : "Resend code"}
          </Button>
        </form>
      )}
    </div>
  );
}

function ErrorMessage({
  id,
  message,
  children,
}: {
  id: string;
  message: string | null;
  children?: React.ReactNode;
}) {
  return (
    <div aria-live="assertive" className="empty:hidden">
      {message && (
        <div className="flex flex-col items-start gap-1 rounded-md bg-destructive/8 px-3 py-2">
          <p id={id} className="text-sm text-destructive">
            {message}
          </p>
          {children}
        </div>
      )}
    </div>
  );
}
