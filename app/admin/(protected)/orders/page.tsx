import type { Metadata } from "next";
import Link from "next/link";
import { AlertTriangle, PackageSearch } from "lucide-react";
import { OrderFilters } from "@/components/admin/order-filters";
import { StatusBadge } from "@/components/admin/status-badge";
import { EmptyState } from "@/components/store/empty-state";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { formatInr } from "@/lib/format";
import { listAdminOrders } from "@/lib/orders/admin-queries";
import { fulfillmentStatusLabels, orderStatusLabels, paymentStatusLabels } from "@/lib/orders/labels";
import { type OrderFilters as Filters, orderFiltersSchema } from "@/lib/validators/admin-orders";

export const metadata: Metadata = { title: "Orders" };

const dateTime = new Intl.DateTimeFormat("en-IN", { dateStyle: "medium", timeStyle: "short", timeZone: "Asia/Kolkata" });

export default async function AdminOrdersPage({ searchParams }: PageProps<"/admin/orders">) {
  const filters = orderFiltersSchema.parse(await searchParams);
  const { orders, total, page, pageCount } = await listAdminOrders(filters);

  return (
    <main className="flex flex-col gap-6">
      <div className="flex items-baseline justify-between gap-4">
        <h1 className="text-3xl font-semibold">Orders</h1>
        <p className="text-sm text-muted-foreground" aria-live="polite">
          {total} {total === 1 ? "order" : "orders"}
        </p>
      </div>

      <OrderFilters filters={filters} />

      {orders.length === 0 ? (
        <EmptyState icon={PackageSearch} title="No orders match" description="Try clearing a filter or the search." />
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Order</TableHead>
              <TableHead>Placed</TableHead>
              <TableHead>Customer</TableHead>
              <TableHead className="text-right">Total</TableHead>
              <TableHead>Order</TableHead>
              <TableHead>Payment</TableHead>
              <TableHead>Fulfilment</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {orders.map((o) => (
              <TableRow key={o.id}>
                <TableCell>
                  <Link
                    href={`/admin/orders/${o.id}`}
                    className="inline-flex min-h-touch items-center gap-1.5 rounded-sm font-semibold text-primary outline-none hover:underline focus-visible:ring-3 focus-visible:ring-ring/60"
                  >
                    {o.needsAttention && (
                      <AlertTriangle aria-label="Needs attention" className="size-4 text-destructive" />
                    )}
                    {o.number}
                  </Link>
                </TableCell>
                <TableCell className="text-muted-foreground">{dateTime.format(new Date(o.createdAt))}</TableCell>
                <TableCell>
                  <span className="block">{o.customerName}</span>
                  <span className="block text-xs text-muted-foreground">{o.email}</span>
                </TableCell>
                <TableCell className="text-right tabular-nums">{formatInr(o.totalPaise)}</TableCell>
                <TableCell>
                  <StatusBadge value={o.orderStatus} label={orderStatusLabels[o.orderStatus]} />
                </TableCell>
                <TableCell>
                  <StatusBadge value={o.paymentStatus} label={paymentStatusLabels[o.paymentStatus]} />
                </TableCell>
                <TableCell>
                  <StatusBadge value={o.fulfillmentStatus} label={fulfillmentStatusLabels[o.fulfillmentStatus]} />
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}

      {pageCount > 1 && (
        <nav aria-label="Pages" className="flex items-center justify-between gap-4 text-sm">
          <PageLink filters={filters} page={page - 1} disabled={page <= 1}>
            Previous
          </PageLink>
          <span className="text-muted-foreground">
            Page {page} of {pageCount}
          </span>
          <PageLink filters={filters} page={page + 1} disabled={page >= pageCount}>
            Next
          </PageLink>
        </nav>
      )}
    </main>
  );
}

function PageLink({
  filters,
  page,
  disabled,
  children,
}: {
  filters: Filters;
  page: number;
  disabled: boolean;
  children: React.ReactNode;
}) {
  if (disabled) {
    return (
      <Button variant="outline" disabled>
        {children}
      </Button>
    );
  }
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries({ ...filters, page })) {
    if (value !== undefined && value !== "" && !(key === "page" && value === 1)) params.set(key, String(value));
  }
  const qs = params.toString();
  return (
    <Button asChild variant="outline">
      <Link href={qs ? `/admin/orders?${qs}` : "/admin/orders"}>{children}</Link>
    </Button>
  );
}
