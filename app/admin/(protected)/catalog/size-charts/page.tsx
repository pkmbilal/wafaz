import type { Metadata } from "next";
import { Ruler } from "lucide-react";
import { DeleteButton } from "@/components/admin/delete-button";
import { SizeChartDialog } from "@/components/admin/size-chart-dialog";
import { EmptyState } from "@/components/store/empty-state";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { listAdminSizeCharts } from "@/lib/catalog/admin-queries";

export const metadata: Metadata = { title: "Size charts" };

export default async function SizeChartsPage() {
  const charts = await listAdminSizeCharts();

  return (
    <main className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <h1 className="text-3xl font-semibold">Size charts</h1>
        <SizeChartDialog />
      </div>

      {charts.length === 0 ? (
        <EmptyState icon={Ruler} title="No size charts yet" description="Add one and link it from your products." />
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
