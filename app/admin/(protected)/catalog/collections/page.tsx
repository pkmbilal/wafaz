import type { Metadata } from "next";
import Link from "next/link";
import { LayoutGrid } from "lucide-react";
import { NewCollectionDialog } from "@/components/admin/collection-form";
import { StatusBadge } from "@/components/admin/status-badge";
import { Thumb } from "@/components/admin/thumb";
import { EmptyState } from "@/components/store/empty-state";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { listAdminCollections } from "@/lib/catalog/admin-queries";

export const metadata: Metadata = { title: "Collections" };

export default async function CollectionsPage() {
  const collections = await listAdminCollections();

  return (
    <main className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <h1 className="text-3xl font-semibold">Collections</h1>
        <NewCollectionDialog />
      </div>

      {collections.length === 0 ? (
        <EmptyState icon={LayoutGrid} title="No collections yet" description="Group products into lists like New Arrivals." />
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Collection</TableHead>
              <TableHead>Slug</TableHead>
              <TableHead className="text-right">Products</TableHead>
              <TableHead>Status</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {collections.map((c) => (
              <TableRow key={c.id}>
                <TableCell>
                  <Link
                    href={`/admin/catalog/collections/${c.id}`}
                    className="flex min-h-touch items-center gap-3 rounded-sm font-semibold text-primary outline-none hover:underline focus-visible:ring-3 focus-visible:ring-ring/60"
                  >
                    <Thumb imageKey={c.imageKey} className="w-8" />
                    {c.title}
                  </Link>
                </TableCell>
                <TableCell className="font-mono text-xs text-muted-foreground">{c.slug}</TableCell>
                <TableCell className="text-right tabular-nums">{c.productCount}</TableCell>
                <TableCell>
                  <StatusBadge value={c.isActive ? "active" : "hidden"} label={c.isActive ? "Shown" : "Hidden"} />
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
    </main>
  );
}
