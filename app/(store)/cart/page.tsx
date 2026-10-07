import { Suspense } from "react";
import type { Metadata } from "next";
import { CartPageView } from "@/components/store/cart-page-view";
import { Skeleton } from "@/components/ui/skeleton";
import { getCart } from "@/lib/cart/queries";

// Always dynamic: the cart is read per session behind a Suspense boundary. Visiting this page
// without a session shows the empty cart; it never creates one.
export const metadata: Metadata = {
  title: "Your cart",
  robots: { index: false, follow: false },
};

export default function CartPage() {
  return (
    <div className="mx-auto w-full max-w-5xl px-4 py-8 lg:px-6 lg:py-12">
      <h1 className="mb-6 text-4xl font-semibold sm:text-5xl">Your cart</h1>
      <Suspense fallback={<CartPageSkeleton />}>
        <CartContents />
      </Suspense>
    </div>
  );
}

async function CartContents() {
  const cart = await getCart();
  return <CartPageView initial={cart} />;
}

function CartPageSkeleton() {
  return (
    <div className="grid gap-8 lg:grid-cols-[1fr_20rem]">
      <div className="flex flex-col gap-4">
        <Skeleton className="h-36 w-full" />
        <Skeleton className="h-36 w-full" />
      </div>
      <Skeleton className="h-56 w-full" />
    </div>
  );
}
