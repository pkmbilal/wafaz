import type { Metadata } from "next";
import { TicketPercent } from "lucide-react";
import { CouponDialog } from "@/components/admin/coupon-dialog";
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
    <main className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex flex-col gap-1">
          <h1 className="text-3xl font-semibold">Coupons</h1>
          {!canEdit && <p className="text-sm text-muted-foreground">Only the owner can create or change coupons.</p>}
        </div>
        {canEdit && <CouponDialog />}
      </div>

      {coupons.length === 0 ? (
        <EmptyState icon={TicketPercent} title="No coupons yet" description="Create a code for a sale or a first-order offer." />
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
