import type { Metadata } from "next";
import Link from "next/link";
import { ChevronRight, Package } from "lucide-react";
import { EmptyState } from "@/components/store/empty-state";
import { Badge } from "@/components/ui/badge";
import { requireUser } from "@/lib/auth/session";
import { formatInr } from "@/lib/format";
import { getOrdersForUser } from "@/lib/orders/queries";
import { orderStatusSummary } from "@/lib/orders/status";

export const metadata: Metadata = { title: "My orders" };

const dateFormat = new Intl.DateTimeFormat("en-IN", { dateStyle: "medium", timeZone: "Asia/Kolkata" });

export default async function AccountOrdersPage() {
  const { id } = await requireUser("/account/orders");
  const orders = await getOrdersForUser(id);

  if (orders.length === 0) {
    return (
      <EmptyState
        icon={Package}
        title="No orders yet"
        description="When you place an order, you'll be able to track it here."
        action={{ label: "Start shopping", href: "/collections/new-arrivals" }}
      />
    );
  }

  return (
    <section className="flex flex-col gap-4">
      <h2 className="text-2xl font-semibold">Orders</h2>
      <ul className="flex flex-col divide-y divide-border rounded-lg border border-border bg-card">
        {orders.map((order) => {
          const status = orderStatusSummary(order);
          return (
            <li key={order.id}>
              <Link
                href={`/orders/${order.id}`}
                className="flex min-h-touch items-center gap-3 p-4 outline-none hover:bg-muted focus-visible:ring-3 focus-visible:ring-ring/60"
              >
                <div className="flex min-w-0 flex-1 flex-col gap-1">
                  <p className="font-medium">{order.number}</p>
                  <p className="text-xs text-muted-foreground">
                    {dateFormat.format(new Date(order.createdAt))} · {order.itemCount}{" "}
                    {order.itemCount === 1 ? "item" : "items"} · {formatInr(order.totalPaise)}
                  </p>
                </div>
                <Badge variant={status.tone === "success" ? "secondary" : "outline"}>{status.headline}</Badge>
                <ChevronRight aria-hidden className="size-4 shrink-0 text-muted-foreground" />
              </Link>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
