import type { Metadata } from "next";
import { AdminSection, BackLink } from "@/components/admin/page-parts";
import { ProductForm } from "@/components/admin/product-form";
import { listAdminCategories, listAdminSizeCharts, listTaxHsnCodes } from "@/lib/catalog/admin-queries";
import { EMPTY_PRODUCT } from "@/lib/validators/admin-catalog";

export const metadata: Metadata = { title: "New product" };

export default async function NewProductPage() {
  const [categories, sizeCharts, hsnCodes] = await Promise.all([
    listAdminCategories(),
    listAdminSizeCharts(),
    listTaxHsnCodes(),
  ]);

  return (
    <main className="flex flex-col gap-6">
      <div className="flex flex-col gap-2">
        <BackLink href="/admin/products">Products</BackLink>
        <h1 className="text-3xl font-semibold">New product</h1>
      </div>
      <AdminSection
        id="details"
        title="Details"
        description="The product is saved as a draft. Add variants and images next, then publish it."
      >
        <ProductForm
          defaultValues={EMPTY_PRODUCT}
          categories={categories.map((c) => ({ id: c.id, path: c.path, isActive: c.isActive }))}
          sizeCharts={sizeCharts.map((s) => ({ id: s.id, name: s.name }))}
          hsnCodes={hsnCodes}
        />
      </AdminSection>
    </main>
  );
}
