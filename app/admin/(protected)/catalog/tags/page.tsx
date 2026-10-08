import type { Metadata } from "next";
import { Tags } from "lucide-react";
import { DeleteButton } from "@/components/admin/delete-button";
import { TagDialog } from "@/components/admin/tag-dialog";
import { EmptyState } from "@/components/store/empty-state";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { listAdminTags } from "@/lib/catalog/admin-queries";

export const metadata: Metadata = { title: "Tags" };

export default async function TagsPage() {
  const tags = await listAdminTags();

  return (
    <main className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <h1 className="text-3xl font-semibold">Tags</h1>
        <TagDialog />
      </div>

      {tags.length === 0 ? (
        <EmptyState icon={Tags} title="No tags yet" description="Tags help shoppers find products in search." />
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead>Slug</TableHead>
              <TableHead className="text-right">Products</TableHead>
              <TableHead className="text-right">
                <span className="sr-only">Actions</span>
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {tags.map((t) => (
              <TableRow key={t.id}>
                <TableCell className="font-medium">{t.name}</TableCell>
                <TableCell className="font-mono text-xs text-muted-foreground">{t.slug}</TableCell>
                <TableCell className="text-right tabular-nums">{t.productCount}</TableCell>
                <TableCell>
                  <div className="flex justify-end gap-1">
                    <TagDialog tag={t} />
                    {t.productCount === 0 && <DeleteButton kind="tag" id={t.id} name={t.name} />}
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
