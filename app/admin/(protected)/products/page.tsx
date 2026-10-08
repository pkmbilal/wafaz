import type { Metadata } from "next";
import Link from "next/link";
import { PackageSearch, Plus } from "lucide-react";
import { ProductFilters } from "@/components/admin/product-filters";
import { StatusBadge } from "@/components/admin/status-badge";
import { Thumb } from "@/components/admin/thumb";
import { EmptyState } from "@/components/store/empty-state";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { productStatusLabels } from "@/lib/catalog/admin-labels";
import { listAdminCategories, listAdminProducts } from "@/lib/catalog/admin-queries";
import { formatInr } from "@/lib/format";
import { type ProductListFilters, productListFiltersSchema } from "@/lib/validators/admin-catalog";

export const metadata: Metadata = { title: "Products" };

function priceRange(min: number | null, max: number | null): string {
  if (min === null || max === null) return "—";
  return min === max ? formatInr(min) : `${formatInr(min)} – ${formatInr(max)}`;
}

export default async function AdminProductsPage({ searchParams }: PageProps<"/admin/products">) {
  const filters = productListFiltersSchema.parse(await searchParams);
  const [{ products, total, page, pageCount }, categories] = await Promise.all([
    listAdminProducts(filters),
    listAdminCategories(),
  ]);

  return (
    <main className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-baseline gap-4">
          <h1 className="text-3xl font-semibold">Products</h1>
          <p className="text-sm text-muted-foreground" aria-live="polite">
            {total} {total === 1 ? "product" : "products"}
          </p>
        </div>
        <Button asChild>
          <Link href="/admin/products/new">
            <Plus aria-hidden />
            New product
          </Link>
        </Button>
      </div>

      <ProductFilters filters={filters} categories={categories.map((c) => ({ id: c.id, path: c.path }))} />

      {products.length === 0 ? (
        <EmptyState icon={PackageSearch} title="No products match" description="Try clearing a filter or the search." />
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Product</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Category</TableHead>
              <TableHead className="text-right">Price</TableHead>
              <TableHead className="text-right">Available</TableHead>
              <TableHead className="text-right">Variants</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {products.map((p) => (
              <TableRow key={p.id}>
                <TableCell>
                  <Link
                    href={`/admin/products/${p.id}`}
                    className="flex min-h-touch items-center gap-3 rounded-sm font-semibold text-primary outline-none hover:underline focus-visible:ring-3 focus-visible:ring-ring/60"
                  >
                    <Thumb imageKey={p.imageKey} className="w-10" />
                    <span className="max-w-64 truncate">{p.title}</span>
                  </Link>
                </TableCell>
                <TableCell>
                  <StatusBadge value={p.status} label={productStatusLabels[p.status]} />
                </TableCell>
                <TableCell className="text-muted-foreground">{p.categoryName ?? "—"}</TableCell>
                <TableCell className="text-right tabular-nums">{priceRange(p.minPricePaise, p.maxPricePaise)}</TableCell>
                <TableCell className={`text-right tabular-nums ${p.available <= 0 ? "text-destructive" : ""}`}>
                  {p.available}
                </TableCell>
                <TableCell className="text-right tabular-nums">{p.variantCount}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}

      {pageCount > 1 && (
        <nav aria-label="Pages" className="flex items-center justify-between gap-4 text-sm">
          <PageLink filters={filters} page={page - 1} disabled={page <= 1}>
            Previous
          </PageLink>
          <span className="text-muted-foreground">
            Page {page} of {pageCount}
          </span>
          <PageLink filters={filters} page={page + 1} disabled={page >= pageCount}>
            Next
          </PageLink>
        </nav>
      )}
    </main>
  );
}

function PageLink({
  filters,
  page,
  disabled,
  children,
}: {
  filters: ProductListFilters;
  page: number;
  disabled: boolean;
  children: React.ReactNode;
}) {
  if (disabled) {
    return (
      <Button variant="outline" disabled>
        {children}
      </Button>
    );
  }
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries({ ...filters, page })) {
    if (value !== undefined && value !== "" && !(key === "page" && value === 1)) params.set(key, String(value));
  }
  const qs = params.toString();
  return (
    <Button asChild variant="outline">
      <Link href={qs ? `/admin/products?${qs}` : "/admin/products"}>{children}</Link>
    </Button>
  );
}
