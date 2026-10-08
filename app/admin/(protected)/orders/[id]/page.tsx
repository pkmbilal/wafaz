import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { AlertTriangle, ArrowLeft, ExternalLink, FileDown, Printer } from "lucide-react";
import { z } from "zod";
import { ClearStuckRefundButton, OrderActions, ResolveAttentionDialog } from "@/components/admin/order-actions";
import { StatusBadge } from "@/components/admin/status-badge";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableFooter, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { requireAdmin } from "@/lib/auth/guards";
import { formatInr } from "@/lib/format";
import { getAdminOrder } from "@/lib/orders/admin-queries";
import {
  fulfillmentStatusLabels,
  orderStatusLabels,
  paymentStatusLabels,
  refundKindLabels,
} from "@/lib/orders/labels";
import type { OrderAddress } from "@/lib/orders/queries";
import { courierLabels, trackingUrl } from "@/lib/shipping/tracking";

export const metadata: Metadata = { title: "Order" };

const paramsSchema = z.object({ id: z.uuid() });
const dateTime = new Intl.DateTimeFormat("en-IN", { dateStyle: "medium", timeStyle: "short", timeZone: "Asia/Kolkata" });

const fieldLabels: Record<string, Record<string, string>> = {
  order_status: orderStatusLabels,
  payment_status: paymentStatusLabels,
  fulfillment_status: fulfillmentStatusLabels,
};

export default async function AdminOrderPage({ params }: PageProps<"/admin/orders/[id]">) {
  const parsed = paramsSchema.safeParse(await params);
  if (!parsed.success) notFound();
  const [{ role }, order] = await Promise.all([requireAdmin(), getAdminOrder(parsed.data.id)]);
  if (!order) notFound();

  const isOwner = role === "owner";
  const initiated = order.refunds.find((r) => r.status === "initiated");
  const tracking = order.shipment ? trackingUrl(order.shipment.courier, order.shipment.trackingNumber) : null;

  return (
    <main className="flex flex-col gap-6">
      <div className="flex flex-col gap-2">
        <Link
          href="/admin/orders"
          className="inline-flex min-h-touch w-fit items-center gap-1 rounded-sm text-sm text-muted-foreground outline-none hover:text-primary focus-visible:ring-3 focus-visible:ring-ring/60"
        >
          <ArrowLeft aria-hidden className="size-4" /> Orders
        </Link>
        <div className="flex flex-wrap items-center gap-3">
          <h1 className="text-3xl font-semibold">{order.number}</h1>
          <StatusBadge value={order.orderStatus} label={orderStatusLabels[order.orderStatus]} />
          <StatusBadge value={order.paymentStatus} label={paymentStatusLabels[order.paymentStatus]} />
          <StatusBadge value={order.fulfillmentStatus} label={fulfillmentStatusLabels[order.fulfillmentStatus]} />
        </div>
        <p className="text-sm text-muted-foreground">Placed {dateTime.format(new Date(order.createdAt))}</p>
      </div>

      {order.needsAttention && (
        <div
          role="alert"
          className="flex flex-col gap-3 rounded-lg border border-destructive/30 bg-destructive/5 p-4 sm:flex-row sm:items-center sm:justify-between"
        >
          <p className="flex items-start gap-2 text-sm">
            <AlertTriangle aria-hidden className="mt-0.5 size-4 shrink-0 text-destructive" />
            <span>
              <strong>Needs attention:</strong> {order.attentionReason ?? "Flagged"}
            </span>
          </p>
          <ResolveAttentionDialog orderId={order.id} />
        </div>
      )}

      <div className="grid items-start gap-6 lg:grid-cols-[1fr_20rem]">
        <div className="flex min-w-0 flex-col gap-6">
          <section aria-labelledby="items-heading" className="flex flex-col gap-3">
            <h2 id="items-heading" className="text-2xl font-semibold">
              Items
            </h2>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Item</TableHead>
                  <TableHead className="text-right">Qty</TableHead>
                  <TableHead className="text-right">Refunded</TableHead>
                  <TableHead className="text-right">Unit</TableHead>
                  <TableHead className="text-right">Line (net)</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {order.items.map((i) => (
                  <TableRow key={i.id}>
                    <TableCell>
                      <span className="block font-medium">{i.title}</span>
                      <span className="block text-xs text-muted-foreground">
                        {i.colour} / {i.size} · {i.sku}
                      </span>
                    </TableCell>
                    <TableCell className="text-right tabular-nums">{i.qty}</TableCell>
                    <TableCell className="text-right tabular-nums">{i.refundedQty || "—"}</TableCell>
                    <TableCell className="text-right tabular-nums">{formatInr(i.unitPricePaise)}</TableCell>
                    <TableCell className="text-right tabular-nums">{formatInr(i.lineNetPaise)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
              <TableFooter>
                <SummaryRow label="Subtotal" value={formatInr(order.subtotalPaise)} />
                {order.discountPaise > 0 && (
                  <SummaryRow
                    label={`Discount${order.couponCode ? ` (${order.couponCode})` : ""}`}
                    value={`− ${formatInr(order.discountPaise)}`}
                  />
                )}
                <SummaryRow label="Shipping" value={order.shippingPaise ? formatInr(order.shippingPaise) : "Free"} />
                <SummaryRow
                  label="GST included"
                  value={formatInr(order.cgstPaise + order.sgstPaise + order.igstPaise)}
                />
                <SummaryRow label="Total" value={formatInr(order.totalPaise)} />
              </TableFooter>
            </Table>
          </section>

          <section aria-labelledby="payments-heading" className="flex flex-col gap-3">
            <h2 id="payments-heading" className="text-2xl font-semibold">
              Payments and refunds
            </h2>
            <ul className="flex flex-col divide-y divide-border rounded-lg border border-border bg-card text-sm">
              {order.payments.map((p) => (
                <li key={p.razorpayOrderId} className="flex flex-wrap items-center justify-between gap-2 px-4 py-3">
                  <span>
                    Payment {p.razorpayPaymentId ?? <span className="text-muted-foreground">(not paid)</span>}
                    {p.method && <span className="text-muted-foreground"> · {p.method}</span>}
                  </span>
                  <span className="flex items-center gap-2">
                    <span className="tabular-nums">{formatInr(p.amountPaise)}</span>
                    <StatusBadge value={p.status} label={p.status} />
                  </span>
                </li>
              ))}
              {order.refunds.map((r) => (
                <li key={r.id} className="flex flex-col gap-1 px-4 py-3">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span className="font-medium">{refundKindLabels[r.kind] ?? r.kind}</span>
                    <span className="flex items-center gap-2">
                      <span className="tabular-nums">− {formatInr(r.amountPaise)}</span>
                      <StatusBadge value={r.status} label={r.status} />
                    </span>
                  </div>
                  <p className="text-muted-foreground">
                    {dateTime.format(new Date(r.createdAt))} · {r.reason}
                    {r.razorpayRefundId && ` · ${r.razorpayRefundId}`}
                  </p>
                  {r.error && <p className="text-destructive">{r.error}</p>}
                  {r.creditNote && (
                    <a
                      href={`/api/credit-notes/${r.creditNote.id}`}
                      download
                      className="inline-flex min-h-touch w-fit items-center gap-1.5 rounded-sm text-primary outline-none hover:underline focus-visible:ring-3 focus-visible:ring-ring/60"
                    >
                      <FileDown aria-hidden className="size-4" /> Credit note {r.creditNote.number}
                    </a>
                  )}
                  {r.stuck && isOwner && (
                    <div className="w-fit">
                      <ClearStuckRefundButton orderId={order.id} refundId={r.id} />
                    </div>
                  )}
                </li>
              ))}
            </ul>
          </section>

          <section aria-labelledby="timeline-heading" className="flex flex-col gap-3">
            <h2 id="timeline-heading" className="text-2xl font-semibold">
              Timeline
            </h2>
            <ol className="flex flex-col gap-3 border-l border-border pl-4 text-sm">
              {order.events.map((e) => (
                <li key={e.id} className="flex flex-col">
                  <span className="text-xs text-muted-foreground">
                    {dateTime.format(new Date(e.createdAt))} · {e.bySystem ? "System" : "Admin"}
                  </span>
                  {e.field === "note" ? (
                    <span>{e.note}</span>
                  ) : (
                    <span>
                      {e.field.replace("_status", "").replace("fulfillment", "fulfilment")}:{" "}
                      {e.from ? (fieldLabels[e.field]?.[e.from] ?? e.from) : "—"} →{" "}
                      <strong>{e.to ? (fieldLabels[e.field]?.[e.to] ?? e.to) : "—"}</strong>
                      {e.note && <span className="text-muted-foreground"> · {e.note}</span>}
                    </span>
                  )}
                </li>
              ))}
            </ol>
          </section>
        </div>

        <aside className="flex flex-col gap-4">
          <OrderActions
            orderId={order.id}
            orderStatus={order.orderStatus}
            paymentStatus={order.paymentStatus}
            fulfillmentStatus={order.fulfillmentStatus}
            isOwner={isOwner}
            hasInvoice={order.invoice !== null}
            refundInProgress={initiated !== undefined}
            shippingPaise={order.shippingPaise}
            shippingRefunded={order.shippingRefunded}
            items={order.items.map((i) => ({
              id: i.id,
              title: `${i.title} (${i.colour}, ${i.size})`,
              sku: i.sku,
              qty: i.qty,
              refundedQty: i.refundedQty,
            }))}
          />

          {order.shipment && (
            <Card title="Shipment">
              <p>
                {courierLabels[order.shipment.courier]} · <strong>{order.shipment.trackingNumber}</strong>
              </p>
              <p className="text-muted-foreground">Shipped {dateTime.format(new Date(order.shipment.shippedAt))}</p>
              {order.shipment.deliveredAt && (
                <p className="text-muted-foreground">
                  Delivered {dateTime.format(new Date(order.shipment.deliveredAt))}
                </p>
              )}
              {order.shipment.rtoAt && (
                <p className="text-muted-foreground">RTO {dateTime.format(new Date(order.shipment.rtoAt))}</p>
              )}
              {order.shipment.rtoReceivedAt && (
                <p className="text-muted-foreground">
                  Received back {dateTime.format(new Date(order.shipment.rtoReceivedAt))}
                </p>
              )}
              {tracking && (
                <a
                  href={tracking}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex min-h-touch w-fit items-center gap-1.5 rounded-sm text-primary outline-none hover:underline focus-visible:ring-3 focus-visible:ring-ring/60"
                >
                  Track parcel <ExternalLink aria-hidden className="size-4" />
                </a>
              )}
            </Card>
          )}

          <Card title="Documents">
            <div className="flex flex-col gap-2">
              {order.invoice && (
                <Button asChild variant="outline" size="sm">
                  <a href={`/api/invoices/${order.id}`} download>
                    <FileDown aria-hidden /> Invoice {order.invoice.number}
                  </a>
                </Button>
              )}
              {order.orderStatus === "confirmed" || order.orderStatus === "completed" ? (
                <>
                  <Button asChild variant="outline" size="sm">
                    <a href={`/admin/orders/${order.id}/packing-slip`} target="_blank" rel="noopener">
                      <Printer aria-hidden /> Packing slip
                    </a>
                  </Button>
                  <Button asChild variant="outline" size="sm">
                    <a href={`/admin/orders/${order.id}/label`} target="_blank" rel="noopener">
                      <Printer aria-hidden /> Shipping label
                    </a>
                  </Button>
                </>
              ) : null}
            </div>
          </Card>

          <Card title="Customer">
            <p>{order.email}</p>
            <p>{order.phone}</p>
          </Card>
          <Card title="Ship to">
            <Address a={order.shippingAddress} />
            <p className="text-muted-foreground">{order.totalWeightGrams} g</p>
          </Card>
          <Card title="Bill to">
            <Address a={order.billingAddress} />
          </Card>
        </aside>
      </div>
    </main>
  );
}

function SummaryRow({ label, value }: { label: string; value: string }) {
  return (
    <TableRow>
      <TableCell colSpan={4} className="text-right">
        {label}
      </TableCell>
      <TableCell className="text-right tabular-nums">{value}</TableCell>
    </TableRow>
  );
}

function Card({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="flex flex-col gap-1 rounded-lg border border-border bg-card p-4 text-sm">
      <h2 className="mb-1 font-sans text-sm font-semibold tracking-normal">{title}</h2>
      {children}
    </section>
  );
}

function Address({ a }: { a: OrderAddress }) {
  return (
    <address className="leading-relaxed not-italic">
      {a.name}
      <br />
      {a.line1}
      {a.line2 && (
        <>
          <br />
          {a.line2}
        </>
      )}
      <br />
      {a.city}, {a.state_name} {a.pincode}
      <br />
      {a.phone}
    </address>
  );
}
