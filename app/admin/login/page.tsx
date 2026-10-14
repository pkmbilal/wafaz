import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { AdminPasswordLogin } from "@/components/admin/admin-password-login";
import { getAdminSession } from "@/lib/auth/guards";
import { STORE_NAME, STORE_TAGLINE } from "@/lib/site";

// Session-bearing and never cached: block on the server so signed-in admins get a real redirect.
export const instant = false;

export const metadata: Metadata = {
  title: "Admin sign in",
  robots: { index: false, follow: false },
};

// TailAdmin-style split screen: the form on the left, a brand panel on the right (large screens).
export default async function AdminLoginPage() {
  if (await getAdminSession()) redirect("/admin");

  return (
    <div className="grid min-h-dvh flex-1 bg-card lg:grid-cols-2">
      <div className="flex flex-col px-4 py-6 sm:px-8">
        <Link
          href="/"
          className="inline-flex min-h-touch w-fit items-center gap-1.5 rounded-sm text-sm text-muted-foreground outline-none hover:text-primary focus-visible:ring-3 focus-visible:ring-ring/60"
        >
          <ArrowLeft aria-hidden className="size-4" /> Back to store
        </Link>
        <div className="mx-auto flex w-full max-w-md flex-1 flex-col justify-center gap-8 py-10">
          <div className="flex flex-col gap-2">
            <p className="eyebrow text-primary lg:hidden">{STORE_NAME} admin</p>
            <h1 className="text-4xl font-medium sm:text-5xl">Sign in</h1>
            <p className="text-sm text-muted-foreground">Enter your email and password. For store staff only.</p>
          </div>
          <AdminPasswordLogin />
        </div>
      </div>

      <div
        aria-hidden
        className="relative hidden items-center justify-center overflow-hidden bg-ink text-ink-foreground lg:flex"
      >
        {/* Faint grid, as on TailAdmin's sign-in panel, drawn in the gold accent. */}
        <div className="absolute inset-0 bg-[linear-gradient(to_right,var(--accent)_1px,transparent_1px),linear-gradient(to_bottom,var(--accent)_1px,transparent_1px)] bg-size-[4.5rem_4.5rem] opacity-10 mask-radial-from-20% mask-radial-to-75%" />
        <div className="relative flex flex-col items-center gap-5 text-center">
          <span className="flex size-16 items-center justify-center rounded-xl border border-accent/60 font-heading text-4xl text-accent">
            {STORE_NAME.charAt(0)}
          </span>
          <span className="font-heading text-5xl">{STORE_NAME}</span>
          <span className="eyebrow text-accent">{STORE_TAGLINE}</span>
          <span className="max-w-xs text-sm text-ink-foreground/70">Orders, catalog and settings for the store.</span>
        </div>
      </div>
    </div>
  );
}
