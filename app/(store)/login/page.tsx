import type { Metadata } from "next";
import { redirect } from "next/navigation";
import Link from "next/link";
import { LoginForm } from "@/components/store/auth/login-form";
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
        <h1 className="text-4xl sm:text-5xl">Sign in</h1>
        <span aria-hidden className="mx-auto h-px w-12 bg-accent" />
        <p className="text-sm text-muted-foreground">Welcome back. Sign in with your email and password.</p>
      </div>
      <div className="border border-border bg-card p-6 sm:p-8">
        <LoginForm next={next} />
      </div>
      <p className="text-center text-sm text-muted-foreground">
        New here?{" "}
        <Link
          href={`/signup?next=${encodeURIComponent(next)}`}
          className="font-medium text-primary underline-offset-4 hover:underline"
        >
          Create an account
        </Link>
      </p>
    </div>
  );
}
