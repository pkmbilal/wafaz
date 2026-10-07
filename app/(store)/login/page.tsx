import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { OtpLogin } from "@/components/store/otp-login";
import { getSessionUser } from "@/lib/auth/session";
import { safeNextPath } from "@/lib/validators/auth";

// Session-bearing and never cached: block on the server so signed-in users get a real redirect.
export const instant = false;

export const metadata: Metadata = {
  title: "Sign in",
  robots: { index: false, follow: false },
};

export default async function LoginPage({ searchParams }: PageProps<"/login">) {
  const { next: rawNext } = await searchParams;
  const next = safeNextPath(typeof rawNext === "string" ? rawNext : undefined);

  const user = await getSessionUser();
  if (user && !user.isAnonymous) redirect(next);

  return (
    <div className="mx-auto flex w-full max-w-md flex-col gap-8 px-4 py-10 sm:py-16">
      <div className="flex flex-col gap-2 text-center">
        <h1 className="text-4xl font-semibold sm:text-5xl">Sign in</h1>
        <p className="text-sm text-muted-foreground">
          No password needed. We&apos;ll send you a one-time code.
        </p>
      </div>
      <div className="rounded-lg border border-border bg-card p-5 shadow-soft sm:p-6">
        <OtpLogin next={next} />
      </div>
      <p className="text-center text-xs text-muted-foreground">
        Signing in creates an account if you don&apos;t have one yet. Your cart and saved addresses
        come with you.
      </p>
    </div>
  );
}
