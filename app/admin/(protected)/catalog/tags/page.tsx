import type { Metadata } from "next";
import { Tags } from "lucide-react";
import { CatalogNav } from "@/components/admin/catalog-nav";
import { DeleteButton } from "@/components/admin/delete-button";
import { AdminCard, PageHeader } from "@/components/admin/page-parts";
import { TagDialog } from "@/components/admin/tag-dialog";
import { EmptyState } from "@/components/store/empty-state";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { listAdminTags } from "@/lib/catalog/admin-queries";

export const metadata: Metadata = { title: "Tags" };

export default async function TagsPage() {
  const tags = await listAdminTags();

  return (
    <main className="flex flex-col gap-4 md:gap-6">
      <PageHeader title="Tags" crumbs={[{ label: "Catalog" }]} actions={<TagDialog />} />
      <CatalogNav />

      {tags.length === 0 ? (
        <AdminCard flush>
          <EmptyState
            icon={Tags}
            title="No tags yet"
            description="Tags help shoppers find products in search."
            className="bg-card"
          />
        </AdminCard>
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
