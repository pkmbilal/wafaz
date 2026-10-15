import Link from "next/link";
import {
  AlertTriangle,
  ArrowRight,
  CheckCircle2,
  IndianRupee,
  type LucideIcon,
  PackageX,
  ShoppingBag,
  Truck,
} from "lucide-react";
import { cn } from "cn";
import { AdminCard, PageHeader } from "@/components/admin/page-parts";
import { ProcessDeletionButton } from "@/components/admin/process-deletion-button";
import { listDeletionRequests } from "@/lib/admin/queries";
import { requireAdmin } from "@/lib/auth/guards";
import { formatInr } from "@/lib/format";
import { getDashboard } from "@/lib/orders/admin-queries";

// Admin dashboard: today's numbers, what needs shipping, low stock and the "Needs attention" panel
// (AGENTS.md §5.12). Webhook failures are visible to the owner only (RLS).
// TODO(owner): a "Monthly revenue" chart needs a time-series query and an approved chart approach.

// The Low stock card lists this many variants; the rest are summarised.
const LOW_STOCK_PREVIEW = 8;

const dateTime = new Intl.DateTimeFormat("en-IN", { dateStyle: "medium", timeStyle: "short", timeZone: "Asia/Kolkata" });

const cardLink =
  "inline-flex min-h-touch items-center gap-1 rounded-sm text-sm font-medium text-primary outline-none hover:underline focus-visible:ring-3 focus-visible:ring-ring/60";

export default async function AdminDashboardPage() {
  const [d, deletions, { role }] = await Promise.all([getDashboard(), listDeletionRequests(), requireAdmin()]);
  const attentionCount =
    d.attentionOrders.length + d.stuckRefunds.length + d.failedWebhooks.length + d.failedEmails.length;

  return (
    <main className="flex flex-col gap-4 md:gap-6">
      <PageHeader title="Dashboard" />

      <section aria-label="Today" className="grid grid-cols-1 gap-4 sm:grid-cols-2 md:gap-6 xl:grid-cols-4">
        <Metric icon={ShoppingBag} label="Paid orders today" value={String(d.today.orders)} />
        <Metric icon={IndianRupee} label="Revenue today" value={formatInr(d.today.revenuePaise)} hint="Before refunds" />
        <Metric
          icon={Truck}
          label="To ship"
          value={String(d.toShip)}
          href="/admin/orders?order=confirmed&fulfillment=unfulfilled"
          tone={d.toShip > 0 ? "warning" : "neutral"}
        />
        <Metric
          icon={PackageX}
          label="Low stock variants"
          value={String(d.lowStock.length)}
          tone={d.lowStock.length > 0 ? "danger" : "neutral"}
        />
      </section>

      <div className="grid grid-cols-1 items-start gap-4 md:gap-6 xl:grid-cols-12">
        <AdminCard
          id="attention"
          className="xl:col-span-7"
          title={
            <span className="flex items-center gap-2">
              {attentionCount > 0 && <AlertTriangle aria-hidden className="size-5 text-destructive" />}
              Needs attention
            </span>
          }
          description="Flagged orders, stuck refunds, and webhook or email failures in the last 24 hours."
          actions={
            attentionCount > 0 ? <CountPill tone="danger">{attentionCount}</CountPill> : undefined
          }
          flush
        >
          {attentionCount === 0 ? (
            <p className="flex items-center gap-3 px-5 py-6 text-sm sm:px-6">
              <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-success/12 text-success">
                <CheckCircle2 aria-hidden className="size-5" />
              </span>
              Nothing needs attention right now.
            </p>
          ) : (
            <div className="flex flex-col divide-y divide-border">
              {d.attentionOrders.length > 0 && (
                <Group title="Flagged orders">
                  {d.attentionOrders.map((o) => (
                    <Row key={o.id} href={`/admin/orders/${o.id}`} title={o.number} detail={o.reason ?? "Flagged"} />
                  ))}
                </Group>
              )}
              {d.stuckRefunds.length > 0 && (
                <Group title="Refunds waiting on Razorpay">
                  {d.stuckRefunds.map((r) => (
                    <Row
                      key={r.orderId + r.createdAt}
                      href={`/admin/orders/${r.orderId}`}
                      title={r.orderNumber}
                      detail={`${formatInr(r.amountPaise)} started ${dateTime.format(new Date(r.createdAt))}`}
                    />
                  ))}
                </Group>
              )}
              {d.failedWebhooks.length > 0 && (
                <Group title="Failed Razorpay webhooks (24 h)">
                  {d.failedWebhooks.map((w) => (
                    <Row
                      key={w.id}
                      title={w.eventType}
                      detail={`${dateTime.format(new Date(w.createdAt))} · ${w.error ?? "unknown error"}`}
                    />
                  ))}
                </Group>
              )}
              {d.failedEmails.length > 0 && (
                <Group title="Failed emails (24 h)">
                  {d.failedEmails.map((e, i) => (
                    <Row
                      key={`${e.orderId}-${e.kind}-${i}`}
                      href={e.orderId ? `/admin/orders/${e.orderId}` : undefined}
                      title={`${e.kind.replaceAll("_", " ")}${e.orderNumber ? ` · ${e.orderNumber}` : ""}`}
                      detail={e.error ?? "unknown error"}
                    />
                  ))}
                </Group>
              )}
            </div>
          )}
        </AdminCard>

        <AdminCard
          id="stock"
          className="xl:col-span-5"
          title="Low stock"
          description="Available units (stock minus reserved)."
          actions={
            <Link href="/admin/products" className={cardLink}>
              See products <ArrowRight aria-hidden className="size-4" />
            </Link>
          }
          flush
        >
          {d.lowStock.length === 0 ? (
            <p className="px-5 py-6 text-sm text-muted-foreground sm:px-6">
              All active variants are above the low-stock threshold.
            </p>
          ) : (
            <ul className="divide-y divide-border">
              {d.lowStock.slice(0, LOW_STOCK_PREVIEW).map((v) => (
                <li key={v.variantId}>
                  <Link
                    href={`/admin/products/${v.productId}`}
                    className="flex min-h-touch items-center justify-between gap-4 px-5 py-3 text-sm outline-none hover:bg-muted/50 focus-visible:ring-3 focus-visible:ring-ring/60 focus-visible:ring-inset sm:px-6"
                  >
                    <span className="flex min-w-0 flex-col">
                      <span className="truncate font-medium">{v.productTitle}</span>
                      <span className="truncate text-muted-foreground">
                        {v.colour} / {v.size} · {v.sku}
                      </span>
                    </span>
                    <CountPill tone={v.available <= 0 ? "danger" : "warning"}>{v.available} left</CountPill>
                  </Link>
                </li>
              ))}
              {d.lowStock.length > LOW_STOCK_PREVIEW && (
                <li className="px-5 py-3 text-sm text-muted-foreground sm:px-6">
                  and {d.lowStock.length - LOW_STOCK_PREVIEW} more
                </li>
              )}
            </ul>
          )}
        </AdminCard>
      </div>

      {deletions.length > 0 && (
        <AdminCard
          id="deletions"
          title="Deletion requests"
          description={`Customers who asked for their account to be deleted. ${
            role === "owner" ? "Processing can't be undone." : "Only the owner can process them."
          }`}
          actions={<CountPill tone="neutral">{deletions.length}</CountPill>}
          flush
        >
          <ul className="divide-y divide-border">
            {deletions.map((r) => (
              <li
                key={r.userId}
                className="flex min-h-touch flex-wrap items-center justify-between gap-2 px-5 py-3 text-sm sm:px-6"
              >
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
        </AdminCard>
      )}
    </main>
  );
}

type Tone = "neutral" | "warning" | "danger";

const iconTone: Record<Tone, string> = {
  neutral: "bg-primary/10 text-primary",
  warning: "bg-accent/20 text-accent-foreground",
  danger: "bg-destructive/10 text-destructive",
};

const pillTone: Record<Tone, string> = {
  neutral: "bg-muted text-muted-foreground",
  warning: "bg-accent/20 text-accent-foreground",
  danger: "bg-destructive/10 text-destructive",
};

function CountPill({ tone, children }: { tone: Tone; children: React.ReactNode }) {
  return (
    <span
      className={cn(
        "inline-flex shrink-0 items-center rounded-full px-2.5 py-0.5 text-xs font-medium tabular-nums",
        pillTone[tone],
      )}
    >
      {children}
    </span>
  );
}

// TailAdmin metric tile: icon square, label, big number.
function Metric({
  icon: Icon,
  label,
  value,
  hint,
  href,
  tone = "neutral",
}: {
  icon: LucideIcon;
  label: string;
  value: string;
  hint?: string;
  href?: string;
  tone?: Tone;
}) {
  const body = (
    <>
      <span className={cn("flex size-12 items-center justify-center rounded-xl", iconTone[tone])}>
        <Icon aria-hidden className="size-6" />
      </span>
      <span className="mt-5 flex items-end justify-between gap-3">
        <span className="flex flex-col gap-1">
          <span className="text-sm text-muted-foreground">{label}</span>
          <span className="text-2xl font-semibold tabular-nums">{value}</span>
        </span>
        {hint && <CountPill tone="neutral">{hint}</CountPill>}
        {href && <ArrowRight aria-hidden className="mb-1 size-5 text-primary" />}
      </span>
    </>
  );
  const className = "flex flex-col rounded-xl border border-border bg-card p-5 shadow-soft md:p-6";
  return href ? (
    <Link
      href={href}
      className={cn(
        className,
        "transition-colors outline-none hover:border-primary/40 focus-visible:ring-3 focus-visible:ring-ring/60",
      )}
    >
      {body}
    </Link>
  ) : (
    <div className={className}>{body}</div>
  );
}

function Group({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col">
      <h3 className="eyebrow px-5 pt-4 pb-1 text-muted-foreground sm:px-6">{title}</h3>
      <ul className="divide-y divide-border">{children}</ul>
    </div>
  );
}

function Row({ title, detail, href }: { title: string; detail: string; href?: string }) {
  const className =
    "flex min-h-touch flex-col justify-center gap-0.5 px-5 py-3 text-sm sm:flex-row sm:items-center sm:justify-between sm:gap-4 sm:px-6";
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
          className={cn(
            className,
            "outline-none hover:bg-muted/50 focus-visible:ring-3 focus-visible:ring-ring/60 focus-visible:ring-inset",
          )}
        >
          {content}
        </Link>
      ) : (
        <div className={className}>{content}</div>
      )}
    </li>
  );
}
