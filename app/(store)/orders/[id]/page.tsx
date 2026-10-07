import { Suspense } from "react";
import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { z } from "zod";
import { OrderStatusTimeline } from "@/components/store/order-status-timeline";
import { OrderSummary } from "@/components/store/order-summary";
import { PaymentPoller } from "@/components/store/payment-poller";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { formatInr } from "@/lib/format";
import { getOrderForViewer } from "@/lib/orders/queries";
import { orderStatusSummary } from "@/lib/orders/status";
import { mediaUrl } from "@/lib/r2";

// Order view: the owner's session or a signed guest link (?t=). Always dynamic, never indexed.
export const metadata: Metadata = {
  title: "Your order",
  robots: { index: false, follow: false },
};

const paramsSchema = z.object({ id: z.uuid() });
const searchSchema = z.object({
  t: z.string().max(100).optional(),
  paid: z.literal("1").optional(),
});

const dateFormat = new Intl.DateTimeFormat("en-IN", {
  dateStyle: "medium",
  timeStyle: "short",
  timeZone: "Asia/Kolkata",
});

export default function OrderPage(props: PageProps<"/orders/[id]">) {
  return (
    <div className="mx-auto w-full max-w-4xl px-4 py-8 lg:px-6 lg:py-12">
      <Suspense fallback={<OrderSkeleton />}>
        <OrderContents {...props} />
      </Suspense>
    </div>
  );
}

async function OrderContents({ params, searchParams }: PageProps<"/orders/[id]">) {
  const parsedParams = paramsSchema.safeParse(await params);
  if (!parsedParams.success) notFound();
  const search = searchSchema.safeParse(await searchParams);
  const query = search.success ? search.data : {};

  const order = await getOrderForViewer(parsedParams.data.id, query.t);
  if (!order) notFound();

  const status = orderStatusSummary(order);
  const confirming = query.paid === "1" && order.orderStatus === "pending_payment";
  const address = order.shippingAddress;

  return (
    <article className="flex flex-col gap-8">
      <header className="flex flex-col gap-2">
        <p className="text-sm text-muted-foreground">
          Order {order.number} · {dateFormat.format(new Date(order.createdAt))}
        </p>
        <h1 className="text-4xl font-semibold sm:text-5xl">
          {confirming ? "Thank you!" : status.headline}
        </h1>
        {order.invoiceNumber && (
          <p className="text-sm text-muted-foreground">Tax invoice {order.invoiceNumber}</p>
        )}
      </header>

      {confirming ? (
        <PaymentPoller />
      ) : (
        order.orderStatus !== "expired" &&
        order.orderStatus !== "cancelled" && <OrderStatusTimeline steps={status.steps} />
      )}

      {order.orderStatus === "expired" && (
        <div className="flex flex-col items-start gap-3 rounded-lg border border-border bg-muted p-4 text-sm">
          <p>The payment window closed before we received your payment, so the items were released.</p>
          <Button asChild variant="outline">
            <Link href="/cart">Back to cart</Link>
          </Button>
        </div>
      )}

      <div className="grid items-start gap-8 lg:grid-cols-[1fr_20rem]">
        <section aria-labelledby="items-heading" className="flex flex-col gap-4">
          <h2 id="items-heading" className="text-2xl font-semibold">
            Items
          </h2>
          <ul className="flex flex-col divide-y divide-border border-y border-border">
            {order.items.map((item) => (
              <li key={item.id} className="flex gap-4 py-4">
                <div className="relative aspect-4/5 w-20 shrink-0 overflow-hidden rounded-md bg-muted">
                  {item.imageKey && (
                    <Image src={mediaUrl(item.imageKey)} alt="" fill sizes="80px" className="object-cover" />
                  )}
                </div>
                <div className="flex min-w-0 flex-1 flex-col gap-1 text-sm">
                  <Link
                    href={`/products/${item.productSlug}`}
                    className="rounded-sm font-medium outline-none hover:text-primary focus-visible:ring-3 focus-visible:ring-ring/60"
                  >
                    {item.title}
                  </Link>
                  <p className="text-xs text-muted-foreground">
                    {item.colour} · Size {item.size} · Qty {item.qty}
                  </p>
                  <p className="font-semibold tabular-nums">{formatInr(item.lineNetPaise)}</p>
                </div>
              </li>
            ))}
          </ul>
        </section>

        <aside className="flex flex-col gap-6 rounded-lg border border-border bg-card p-5 shadow-soft">
          <OrderSummary totals={order} />
          <section aria-labelledby="ship-heading" className="flex flex-col gap-1 text-sm">
            <h2 id="ship-heading" className="font-sans text-sm font-semibold tracking-normal">
              Delivering to
            </h2>
            <address className="leading-relaxed text-foreground/80 not-italic">
              {address.name}
              <br />
              {address.line1}
              {address.line2 && (
                <>
                  <br />
                  {address.line2}
                </>
              )}
              <br />
              {address.city}, {address.state_name} {address.pincode}
              <br />
              {address.phone}
            </address>
          </section>
          {/* TODO(M7): invoice PDF download once documents are rendered. */}
        </aside>
      </div>
    </article>
  );
}

function OrderSkeleton() {
  return (
    <div className="flex flex-col gap-6">
      <Skeleton className="h-6 w-48" />
      <Skeleton className="h-12 w-72" />
      <Skeleton className="h-16 w-full" />
      <Skeleton className="h-64 w-full" />
    </div>
  );
}
