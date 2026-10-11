import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { AdminPasswordLogin } from "@/components/admin/admin-password-login";
import { getAdminSession } from "@/lib/auth/guards";

// Session-bearing and never cached: block on the server so signed-in admins get a real redirect.
export const instant = false;

export const metadata: Metadata = {
  title: "Admin sign in",
  robots: { index: false, follow: false },
};

export default async function AdminLoginPage() {
  if (await getAdminSession()) redirect("/admin");

  return (
    <div className="mx-auto flex w-full max-w-md flex-col gap-8 px-4 py-10 sm:py-16">
      <div className="flex flex-col gap-2 text-center">
        <h1 className="text-4xl font-semibold sm:text-5xl">Admin sign in</h1>
        <p className="text-sm text-muted-foreground">For store staff only.</p>
      </div>
      <div className="rounded-lg border border-border bg-card p-5 shadow-soft sm:p-6">
        <AdminPasswordLogin />
      </div>
    </div>
  );
}
