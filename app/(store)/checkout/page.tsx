import { Suspense } from "react";
import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { CheckoutView } from "@/components/store/checkout-view";
import { Skeleton } from "@/components/ui/skeleton";
import { getAccountProfile, getSavedAddresses } from "@/lib/account/queries";
import { getSessionUser } from "@/lib/auth/session";
import { getCart } from "@/lib/cart/queries";
import { getIndianStates } from "@/lib/catalog/queries";

// Always dynamic: everything here depends on the session. Never indexed.
export const metadata: Metadata = {
  title: "Checkout",
  robots: { index: false, follow: false },
};

export default function CheckoutPage() {
  return (
    <div className="mx-auto w-full max-w-6xl px-4 py-8 lg:px-6 lg:py-12">
      <h1 className="mb-6 text-4xl font-semibold sm:text-5xl">Checkout</h1>
      <Suspense fallback={<CheckoutSkeleton />}>
        <CheckoutContents />
      </Suspense>
    </div>
  );
}

async function CheckoutContents() {
  const user = await getSessionUser();
  if (!user) redirect("/cart");

  const [cart, states, profile, saved] = await Promise.all([
    getCart(),
    getIndianStates(),
    getAccountProfile(user.id),
    user.isAnonymous ? Promise.resolve([]) : getSavedAddresses(user.id),
  ]);
  if (cart.lines.length === 0 || cart.hasIssues) redirect("/cart");

  return (
    <CheckoutView
      cart={cart}
      states={states}
      savedAddresses={saved}
      defaultContact={{ email: profile.email ?? "", phone: profile.phone ?? "" }}
      defaultName={profile.fullName ?? ""}
    />
  );
}

function CheckoutSkeleton() {
  return (
    <div className="grid gap-8 lg:grid-cols-[1fr_22rem]">
      <div className="flex flex-col gap-4">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-48 w-full" />
        <Skeleton className="h-16 w-full" />
      </div>
      <Skeleton className="h-64 w-full" />
    </div>
  );
}
