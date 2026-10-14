import type { Metadata } from "next";
import { TicketPercent } from "lucide-react";
import { CouponDialog } from "@/components/admin/coupon-dialog";
import { AdminCard, PageHeader } from "@/components/admin/page-parts";
import { StatusBadge } from "@/components/admin/status-badge";
import { EmptyState } from "@/components/store/empty-state";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { type AdminCoupon, type CouponState, listAdminCoupons } from "@/lib/admin/queries";
import { requireAdmin } from "@/lib/auth/guards";
import { formatInr } from "@/lib/format";

export const metadata: Metadata = { title: "Coupons" };

const dateTime = new Intl.DateTimeFormat("en-IN", { dateStyle: "medium", timeStyle: "short", timeZone: "Asia/Kolkata" });

const stateBadges: Record<CouponState, { value: string; label: string }> = {
  off: { value: "hidden", label: "Off" },
  scheduled: { value: "pending", label: "Scheduled" },
  ended: { value: "expired", label: "Ended" },
  used_up: { value: "expired", label: "Used up" },
  live: { value: "active", label: "Live" },
};

function discount(c: AdminCoupon): string {
  if (c.kind === "flat") return `${formatInr(c.value)} off`;
  return c.maxDiscountPaise ? `${c.value}% off (max ${formatInr(c.maxDiscountPaise)})` : `${c.value}% off`;
}

function rules(c: AdminCoupon): string {
  const parts = [
    c.minCartPaise > 0 ? `min ${formatInr(c.minCartPaise)}` : null,
    c.perUserLimit ? `${c.perUserLimit} per customer` : null,
    c.firstOrderOnly ? "first order only" : null,
    c.endsAt ? `until ${dateTime.format(new Date(c.endsAt))}` : null,
  ].filter(Boolean);
  return parts.length ? parts.join(" · ") : "No limits";
}

export default async function CouponsPage() {
  const [{ role }, coupons] = await Promise.all([requireAdmin(), listAdminCoupons()]);
  const canEdit = role === "owner";

  return (
    <main className="flex flex-col gap-4 md:gap-6">
      <PageHeader
        title="Coupons"
        meta={!canEdit ? <p>Only the owner can create or change coupons.</p> : undefined}
        actions={canEdit ? <CouponDialog /> : undefined}
      />

      {coupons.length === 0 ? (
        <AdminCard flush>
          <EmptyState
            icon={TicketPercent}
            title="No coupons yet"
            description="Create a code for a sale or a first-order offer."
            className="bg-card"
          />
        </AdminCard>
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Code</TableHead>
              <TableHead>Discount</TableHead>
              <TableHead>Rules</TableHead>
              <TableHead className="text-right">Used</TableHead>
              <TableHead>Status</TableHead>
              {canEdit && (
                <TableHead className="text-right">
                  <span className="sr-only">Actions</span>
                </TableHead>
              )}
            </TableRow>
          </TableHeader>
          <TableBody>
            {coupons.map((c) => {
              const state = stateBadges[c.state];
              return (
                <TableRow key={c.id}>
                  <TableCell className="font-mono font-semibold">{c.code}</TableCell>
                  <TableCell>{discount(c)}</TableCell>
                  <TableCell className="text-muted-foreground">{rules(c)}</TableCell>
                  <TableCell className="text-right tabular-nums">
                    {c.usedCount}
                    {c.maxUses ? ` / ${c.maxUses}` : ""}
                  </TableCell>
                  <TableCell>
                    <StatusBadge value={state.value} label={state.label} />
                  </TableCell>
                  {canEdit && (
                    <TableCell className="text-right">
                      <CouponDialog coupon={c} />
                    </TableCell>
                  )}
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      )}
    </main>
  );
}
