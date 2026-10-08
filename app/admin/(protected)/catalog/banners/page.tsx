import type { Metadata } from "next";
import { GalleryHorizontal } from "lucide-react";
import { BannerDialog } from "@/components/admin/banner-dialog";
import { DeleteButton } from "@/components/admin/delete-button";
import { StatusBadge } from "@/components/admin/status-badge";
import { Thumb } from "@/components/admin/thumb";
import { EmptyState } from "@/components/store/empty-state";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { type AdminBanner, type BannerState, listAdminBanners } from "@/lib/catalog/admin-queries";

export const metadata: Metadata = { title: "Banners" };

const dateTime = new Intl.DateTimeFormat("en-IN", { dateStyle: "medium", timeStyle: "short", timeZone: "Asia/Kolkata" });

const stateBadges: Record<BannerState, { value: string; label: string }> = {
  off: { value: "hidden", label: "Off" },
  scheduled: { value: "pending", label: "Scheduled" },
  ended: { value: "expired", label: "Ended" },
  live: { value: "active", label: "Live" },
};

function schedule(b: AdminBanner): string {
  if (!b.startsAt && !b.endsAt) return "Always";
  const from = b.startsAt ? dateTime.format(new Date(b.startsAt)) : "now";
  const to = b.endsAt ? dateTime.format(new Date(b.endsAt)) : "no end";
  return `${from} → ${to}`;
}

export default async function BannersPage() {
  const banners = await listAdminBanners();

  return (
    <main className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <h1 className="text-3xl font-semibold">Banners</h1>
        <BannerDialog />
      </div>

      {banners.length === 0 ? (
        <EmptyState icon={GalleryHorizontal} title="No banners yet" description="Add a hero banner for the home page." />
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Banner</TableHead>
              <TableHead>Link</TableHead>
              <TableHead>Schedule</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">
                <span className="sr-only">Actions</span>
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {banners.map((b) => {
              const state = stateBadges[b.state];
              return (
                <TableRow key={b.id}>
                  <TableCell>
                    <div className="flex items-center gap-3">
                      <Thumb imageKey={b.imageKey} className="aspect-[16/7] w-24" />
                      <span className="font-medium">{b.title}</span>
                    </div>
                  </TableCell>
                  <TableCell className="font-mono text-xs text-muted-foreground">{b.link ?? "—"}</TableCell>
                  <TableCell className="text-muted-foreground">{schedule(b)}</TableCell>
                  <TableCell>
                    <StatusBadge value={state.value} label={state.label} />
                  </TableCell>
                  <TableCell>
                    <div className="flex justify-end gap-1">
                      <BannerDialog banner={b} />
                      <DeleteButton kind="banner" id={b.id} name={b.title} />
                    </div>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      )}
    </main>
  );
}
