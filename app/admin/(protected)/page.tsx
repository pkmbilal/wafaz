import Link from "next/link";
import { AlertTriangle } from "lucide-react";
import { ProcessDeletionButton } from "@/components/admin/process-deletion-button";
import { listDeletionRequests } from "@/lib/admin/queries";
import { requireAdmin } from "@/lib/auth/guards";
import { formatInr } from "@/lib/format";
import { getDashboard } from "@/lib/orders/admin-queries";

// Admin dashboard: today's numbers, what needs shipping, low stock and the "Needs attention" panel
// (AGENTS.md §5.12). Webhook and OTP failures are visible to the owner only (RLS).

const dateTime = new Intl.DateTimeFormat("en-IN", { dateStyle: "medium", timeStyle: "short", timeZone: "Asia/Kolkata" });

export default async function AdminDashboardPage() {
  const [d, deletions, { role }] = await Promise.all([getDashboard(), listDeletionRequests(), requireAdmin()]);
  const attentionCount =
    d.attentionOrders.length + d.stuckRefunds.length + d.failedWebhooks.length + d.failedEmails.length + d.failedOtpSends;

  return (
    <main className="flex flex-col gap-8">
      <h1 className="text-3xl font-semibold">Dashboard</h1>

      <section aria-label="Today" className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat label="Paid orders today" value={String(d.today.orders)} />
        <Stat label="Revenue today" value={formatInr(d.today.revenuePaise)} hint="Before refunds" />
        <Stat label="To ship" value={String(d.toShip)} href="/admin/orders?order=confirmed&fulfillment=unfulfilled" />
        <Stat label="Low stock variants" value={String(d.lowStock.length)} />
      </section>

      <section aria-labelledby="attention-heading" className="flex flex-col gap-3">
        <h2 id="attention-heading" className="flex items-center gap-2 text-2xl font-semibold">
          {attentionCount > 0 && <AlertTriangle aria-hidden className="size-5 text-destructive" />}
          Needs attention
        </h2>
        {attentionCount === 0 ? (
          <p className="rounded-lg border border-border bg-card p-4 text-sm text-muted-foreground">
            Nothing needs attention right now.
          </p>
        ) : (
          <div className="flex flex-col gap-4">
            {d.attentionOrders.length > 0 && (
              <Panel title="Flagged orders">
                {d.attentionOrders.map((o) => (
                  <Row key={o.id} href={`/admin/orders/${o.id}`} title={o.number} detail={o.reason ?? "Flagged"} />
                ))}
              </Panel>
            )}
            {d.stuckRefunds.length > 0 && (
              <Panel title="Refunds waiting on Razorpay">
                {d.stuckRefunds.map((r) => (
                  <Row
                    key={r.orderId + r.createdAt}
                    href={`/admin/orders/${r.orderId}`}
                    title={r.orderNumber}
                    detail={`${formatInr(r.amountPaise)} started ${dateTime.format(new Date(r.createdAt))}`}
                  />
                ))}
              </Panel>
            )}
            {d.failedWebhooks.length > 0 && (
              <Panel title="Failed Razorpay webhooks (24 h)">
                {d.failedWebhooks.map((w) => (
                  <Row
                    key={w.id}
                    title={w.eventType}
                    detail={`${dateTime.format(new Date(w.createdAt))} · ${w.error ?? "unknown error"}`}
                  />
                ))}
              </Panel>
            )}
            {d.failedEmails.length > 0 && (
              <Panel title="Failed emails (24 h)">
                {d.failedEmails.map((e, i) => (
                  <Row
                    key={`${e.orderId}-${e.kind}-${i}`}
                    href={e.orderId ? `/admin/orders/${e.orderId}` : undefined}
                    title={`${e.kind.replaceAll("_", " ")}${e.orderNumber ? ` · ${e.orderNumber}` : ""}`}
                    detail={e.error ?? "unknown error"}
                  />
                ))}
              </Panel>
            )}
            {d.failedOtpSends > 0 && (
              <Panel title="WhatsApp OTP sends (24 h)">
                <Row title={`${d.failedOtpSends} failed`} detail="Customers were offered email OTP instead." />
              </Panel>
            )}
          </div>
        )}
      </section>

      {deletions.length > 0 && (
        <section aria-labelledby="deletions-heading" className="flex flex-col gap-3">
          <h2 id="deletions-heading" className="text-2xl font-semibold">
            Deletion requests
          </h2>
          <div className="rounded-lg border border-border bg-card">
            <p className="border-b border-border px-4 py-2 text-sm text-muted-foreground">
              Customers who asked for their account to be deleted.{" "}
              {role === "owner" ? "Processing can't be undone." : "Only the owner can process them."}
            </p>
            <ul className="divide-y divide-border">
              {deletions.map((r) => (
                <li key={r.userId} className="flex min-h-touch flex-wrap items-center justify-between gap-2 px-4 py-2 text-sm">
                  <span>
                    <span className="font-medium">Requested {dateTime.format(new Date(r.requestedAt))}</span>
                    <span className="block text-muted-foreground">
                      {r.orderCount === 0 ? "No orders" : `${r.orderCount} ${r.orderCount === 1 ? "order" : "orders"} (kept)`}
                    </span>
                  </span>
                  {role === "owner" && <ProcessDeletionButton userId={r.userId} orderCount={r.orderCount} />}
                </li>
              ))}
            </ul>
          </div>
        </section>
      )}

      <section aria-labelledby="stock-heading" className="flex flex-col gap-3">
        <h2 id="stock-heading" className="text-2xl font-semibold">
          Low stock
        </h2>
        {d.lowStock.length === 0 ? (
          <p className="text-sm text-muted-foreground">All active variants are above the low-stock threshold.</p>
        ) : (
          <Panel title="Available units (stock minus reserved)">
            {d.lowStock.map((v) => (
              <Row
                key={v.variantId}
                href={`/admin/products/${v.productId}`}
                title={`${v.productTitle} · ${v.colour} / ${v.size}`}
                detail={`${v.sku} · ${v.available} left`}
              />
            ))}
          </Panel>
        )}
      </section>
    </main>
  );
}

function Stat({ label, value, hint, href }: { label: string; value: string; hint?: string; href?: string }) {
  const body = (
    <>
      <p className="text-xs font-semibold tracking-wider text-muted-foreground uppercase">{label}</p>
      <p className="mt-1 text-2xl font-semibold tabular-nums">{value}</p>
      {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
    </>
  );
  const className = "rounded-lg border border-border bg-card p-4 shadow-soft";
  return href ? (
    <Link href={href} className={`${className} outline-none hover:border-primary/40 focus-visible:ring-3 focus-visible:ring-ring/60`}>
      {body}
    </Link>
  ) : (
    <div className={className}>{body}</div>
  );
}

function Panel({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-lg border border-border bg-card">
      <h3 className="border-b border-border px-4 py-2 font-sans text-sm font-semibold tracking-normal">{title}</h3>
      <ul className="divide-y divide-border">{children}</ul>
    </div>
  );
}

function Row({ title, detail, href }: { title: string; detail: string; href?: string }) {
  const content = (
    <>
      <span className="font-medium">{title}</span>
      <span className="text-muted-foreground">{detail}</span>
    </>
  );
  return (
    <li>
      {href ? (
        <Link
          href={href}
          className="flex min-h-touch flex-col justify-center gap-0.5 px-4 py-2 text-sm outline-none hover:bg-muted/40 focus-visible:ring-3 focus-visible:ring-ring/60 sm:flex-row sm:items-center sm:justify-between sm:gap-4"
        >
          {content}
        </Link>
      ) : (
        <div className="flex min-h-touch flex-col justify-center gap-0.5 px-4 py-2 text-sm sm:flex-row sm:items-center sm:justify-between sm:gap-4">
          {content}
        </div>
      )}
    </li>
  );
}
