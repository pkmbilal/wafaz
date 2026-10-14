import type { Metadata } from "next";
import { Ruler } from "lucide-react";
import { CatalogNav } from "@/components/admin/catalog-nav";
import { DeleteButton } from "@/components/admin/delete-button";
import { AdminCard, PageHeader } from "@/components/admin/page-parts";
import { SizeChartDialog } from "@/components/admin/size-chart-dialog";
import { EmptyState } from "@/components/store/empty-state";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { listAdminSizeCharts } from "@/lib/catalog/admin-queries";

export const metadata: Metadata = { title: "Size charts" };

export default async function SizeChartsPage() {
  const charts = await listAdminSizeCharts();

  return (
    <main className="flex flex-col gap-4 md:gap-6">
      <PageHeader title="Size charts" crumbs={[{ label: "Catalog" }]} actions={<SizeChartDialog />} />
      <CatalogNav />

      {charts.length === 0 ? (
        <AdminCard flush>
          <EmptyState
            icon={Ruler}
            title="No size charts yet"
            description="Add one and link it from your products."
            className="bg-card"
          />
        </AdminCard>
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead>Sizes</TableHead>
              <TableHead className="text-right">Products</TableHead>
              <TableHead className="text-right">
                <span className="sr-only">Actions</span>
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {charts.map((s) => (
              <TableRow key={s.id}>
                <TableCell className="font-medium">{s.name}</TableCell>
                <TableCell className="text-muted-foreground">
                  {s.data.rows.map((r) => r[0]).join(", ")} ({s.data.unit})
                </TableCell>
                <TableCell className="text-right tabular-nums">{s.productCount}</TableCell>
                <TableCell>
                  <div className="flex justify-end gap-1">
                    <SizeChartDialog chart={s} />
                    {s.productCount === 0 && <DeleteButton kind="sizeChart" id={s.id} name={s.name} />}
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
    </main>
  );
}
