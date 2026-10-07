import type { Metadata } from "next";
import { AccountNav } from "@/components/store/account/account-nav";
import { requireUser } from "@/lib/auth/session";

// Account pages are always dynamic and block on the server so guests get a real redirect.
export const instant = false;

export const metadata: Metadata = {
  title: "My account",
  robots: { index: false, follow: false },
};

export default async function AccountLayout({ children }: LayoutProps<"/account">) {
  await requireUser();

  return (
    <div className="mx-auto w-full max-w-5xl px-4 py-8 lg:px-6 lg:py-12">
      <h1 className="mb-6 text-4xl font-semibold sm:text-5xl">My account</h1>
      <div className="flex flex-col gap-8 md:flex-row md:gap-12">
        <AccountNav />
        <div className="min-w-0 flex-1">{children}</div>
      </div>
    </div>
  );
}
