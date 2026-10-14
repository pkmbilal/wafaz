import type { Metadata } from "next";
import Link from "next/link";
import { LayoutGrid } from "lucide-react";
import { CatalogNav } from "@/components/admin/catalog-nav";
import { NewCollectionDialog } from "@/components/admin/collection-form";
import { AdminCard, PageHeader } from "@/components/admin/page-parts";
import { StatusBadge } from "@/components/admin/status-badge";
import { Thumb } from "@/components/admin/thumb";
import { EmptyState } from "@/components/store/empty-state";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { listAdminCollections } from "@/lib/catalog/admin-queries";

export const metadata: Metadata = { title: "Collections" };

export default async function CollectionsPage() {
  const collections = await listAdminCollections();

  return (
    <main className="flex flex-col gap-4 md:gap-6">
      <PageHeader title="Collections" crumbs={[{ label: "Catalog" }]} actions={<NewCollectionDialog />} />
      <CatalogNav />

      {collections.length === 0 ? (
        <AdminCard flush>
          <EmptyState
            icon={LayoutGrid}
            title="No collections yet"
            description="Group products into lists like New Arrivals."
            className="bg-card"
          />
        </AdminCard>
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
