import type { Metadata } from "next";
import { FolderTree } from "lucide-react";
import { CategoryDialog } from "@/components/admin/category-dialog";
import { DeleteButton } from "@/components/admin/delete-button";
import { StatusBadge } from "@/components/admin/status-badge";
import { Thumb } from "@/components/admin/thumb";
import { EmptyState } from "@/components/store/empty-state";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { listAdminCategories } from "@/lib/catalog/admin-queries";

export const metadata: Metadata = { title: "Categories" };

export default async function CategoriesPage() {
  const categories = await listAdminCategories();
  const parents = categories.map((c) => ({ id: c.id, parentId: c.parentId, path: c.path }));
  const childCount = (id: string) => categories.filter((c) => c.parentId === id).length;

  return (
    <main className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <h1 className="text-3xl font-semibold">Categories</h1>
        <CategoryDialog categories={parents} />
      </div>

      {categories.length === 0 ? (
        <EmptyState icon={FolderTree} title="No categories yet" description="Add one to start building the store menu." />
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead>Slug</TableHead>
              <TableHead className="text-right">Products</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">
                <span className="sr-only">Actions</span>
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {categories.map((c) => {
              const inUse = c.productCount > 0 || childCount(c.id) > 0;
              return (
                <TableRow key={c.id}>
                  <TableCell>
                    <div className="flex items-center gap-3" style={{ paddingInlineStart: `${c.depth * 1.5}rem` }}>
                      <Thumb imageKey={c.imageKey} className="w-8" />
                      <span className="font-medium">{c.name}</span>
                    </div>
                  </TableCell>
                  <TableCell className="font-mono text-xs text-muted-foreground">{c.slug}</TableCell>
                  <TableCell className="text-right tabular-nums">{c.productCount}</TableCell>
                  <TableCell>
                    <StatusBadge value={c.isActive ? "active" : "hidden"} label={c.isActive ? "Shown" : "Hidden"} />
                  </TableCell>
                  <TableCell>
                    <div className="flex justify-end gap-1">
                      <CategoryDialog category={c} categories={parents} />
                      {!inUse && (
                        <DeleteButton kind="category" id={c.id} name={c.name} />
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      )}
      <p className="text-sm text-muted-foreground">
        Categories with products or sub-categories can&apos;t be deleted. Hide them instead.
      </p>
    </main>
  );
}
