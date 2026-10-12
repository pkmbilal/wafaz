import type { Metadata } from "next";
import { redirect } from "next/navigation";
import Link from "next/link";
import { SignupForm } from "@/components/store/auth/signup-form";
import { getSessionUser } from "@/lib/auth/session";
import { safeNextPath } from "@/lib/validators/auth";

// Session-bearing and never cached: block on the server so signed-in users get a real redirect.
export const instant = false;

export const metadata: Metadata = {
  title: "Create account",
  robots: { index: false, follow: false },
};

export default async function SignupPage({ searchParams }: PageProps<"/signup">) {
  const { next: rawNext } = await searchParams;
  const next = safeNextPath(typeof rawNext === "string" ? rawNext : undefined);

  const user = await getSessionUser();
  if (user && !user.isAnonymous) redirect(next);

  return (
    <div className="mx-auto flex w-full max-w-md flex-col gap-8 px-4 py-10 sm:py-16">
      <div className="flex flex-col gap-2 text-center">
        <h1 className="text-4xl sm:text-5xl">Create account</h1>
        <span aria-hidden className="mx-auto h-px w-12 bg-accent" />
        <p className="text-sm text-muted-foreground">Save your addresses, track orders and check out faster.</p>
      </div>
      <div className="border border-border bg-card p-6 sm:p-8">
        <SignupForm next={next} />
      </div>
      <p className="text-center text-sm text-muted-foreground">
        Already have an account?{" "}
        <Link
          href={`/login?next=${encodeURIComponent(next)}`}
          className="font-medium text-primary underline-offset-4 hover:underline"
        >
          Sign in
        </Link>
      </p>
    </div>
  );
}
