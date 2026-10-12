"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Eye, EyeOff } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useOptionalCart } from "@/components/store/cart-provider";
import { finishLogin } from "@/app/(store)/login/actions";
import { createClient } from "@/lib/supabase/browser";

export const RESEND_SECONDS = 60;
export const CAPTCHA_PENDING = "Please wait for the security check to finish.";
export const GENERIC_ERROR = "Something went wrong. Please try again.";

// Access token of the current session if it is a guest's. Read it *before* the session changes:
// its signature proves to finishLogin that this browser held the guest session (for the merge).
export async function guestAccessToken(): Promise<string | undefined> {
  const { data } = await createClient().auth.getSession();
  return data.session?.user.is_anonymous === true ? data.session.access_token : undefined;
}

// Merges the guest (if any), reloads the cart and goes to `next`.
export function useCompleteSignIn(next: string | undefined) {
  const router = useRouter();
  const cart = useOptionalCart();
  return async (guestToken: string | undefined): Promise<string | null> => {
    const result = await finishLogin({ guestAccessToken: guestToken, next });
    if (!result.ok) return result.error;
    // The guest's cart may have merged into the account's cart.
    void cart?.reload();
    router.replace(result.redirectTo);
    router.refresh();
    return null;
  };
}

export function useCooldown(initialSeconds = 0) {
  const [seconds, setSeconds] = useState(initialSeconds);
  useEffect(() => {
    if (seconds <= 0) return;
    const t = setTimeout(() => setSeconds((s) => s - 1), 1000);
    return () => clearTimeout(t);
  }, [seconds]);
  return [seconds, setSeconds] as const;
}

export function PasswordInput(props: Omit<React.ComponentProps<typeof Input>, "type">) {
  const [visible, setVisible] = useState(false);
  return (
    <div className="relative">
      <Input {...props} type={visible ? "text" : "password"} maxLength={72} className="pr-12" />
      <Button
        type="button"
        variant="ghost"
        size="icon"
        className="absolute inset-y-0 right-0 h-full min-h-touch w-12 text-muted-foreground"
        aria-label={visible ? "Hide password" : "Show password"}
        aria-pressed={visible}
        onClick={() => setVisible((v) => !v)}
      >
        {visible ? <EyeOff aria-hidden /> : <Eye aria-hidden />}
      </Button>
    </div>
  );
}

export function FormError({
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

export function LiveStatus({ message }: { message: string }) {
  return (
    <p aria-live="polite" role="status" className="sr-only">
      {message}
    </p>
  );
}
