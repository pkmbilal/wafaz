import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ExternalLink } from "lucide-react";
import { z } from "zod";
import { MediaManager } from "@/components/admin/media-manager";
import { AdminSection, BackLink } from "@/components/admin/page-parts";
import { ProductForm } from "@/components/admin/product-form";
import { ProductCollectionsEditor, ProductTagsEditor } from "@/components/admin/product-links";
import { StatusBadge } from "@/components/admin/status-badge";
import { VariantEditor } from "@/components/admin/variant-editor";
import { Button } from "@/components/ui/button";
import { productStatusLabels } from "@/lib/catalog/admin-labels";
import {
  getAdminProduct,
  listAdminCategories,
  listAdminCollections,
  listAdminSizeCharts,
  listAdminTags,
  listTaxHsnCodes,
} from "@/lib/catalog/admin-queries";

export const metadata: Metadata = { title: "Edit product" };

const paramsSchema = z.object({ id: z.uuid() });

export default async function EditProductPage({ params }: PageProps<"/admin/products/[id]">) {
  const parsed = paramsSchema.safeParse(await params);
  if (!parsed.success) notFound();
  const [product, categories, sizeCharts, hsnCodes, tags, collections] = await Promise.all([
    getAdminProduct(parsed.data.id),
    listAdminCategories(),
    listAdminSizeCharts(),
    listTaxHsnCodes(),
    listAdminTags(),
    listAdminCollections(),
  ]);
  if (!product) notFound();

  const colours = [...new Set(product.variants.map((v) => v.colour))];
  const activeVariants = product.variants.filter((v) => v.isActive).length;
  // Remount the client editors when the saved data changes, so they start from the new values.
  const variantsVersion = product.variants
    .map((v) => [v.id, v.sku, v.size, v.colour, v.colourHex, v.mrpPaise, v.pricePaise, v.weightGrams, v.stock, v.reserved, v.isActive].join(":"))
    .join("|");

  return (
    <main className="flex flex-col gap-6">
      <div className="flex flex-col gap-2">
        <BackLink href="/admin/products">Products</BackLink>
        <div className="flex flex-wrap items-center gap-3">
          <h1 className="text-3xl font-semibold">{product.details.title}</h1>
          <StatusBadge value={product.status} label={productStatusLabels[product.status]} />
          {product.status === "active" && (
            <Button asChild variant="link" size="sm" className="px-0">
              <Link href={`/products/${product.details.slug}`} target="_blank">
                View in store <ExternalLink aria-hidden />
                <span className="sr-only">(opens in a new tab)</span>
              </Link>
            </Button>
          )}
        </div>
        {product.status === "draft" && (
          <p className="text-sm text-muted-foreground">
            Draft: hidden from the store.{" "}
            {activeVariants === 0
              ? "Add variants, then set the status to Active to publish."
              : product.media.length === 0
                ? "Add images, then set the status to Active to publish."
                : "Set the status to Active to publish."}
          </p>
        )}
      </div>

      <AdminSection id="details" title="Details">
        <ProductForm
          key={product.updatedAt}
          productId={product.id}
          defaultValues={product.details}
          categories={categories.map((c) => ({ id: c.id, path: c.path, isActive: c.isActive }))}
          sizeCharts={sizeCharts.map((s) => ({ id: s.id, name: s.name }))}
          hsnCodes={hsnCodes}
        />
      </AdminSection>

      <AdminSection
        id="variants"
        title="Variants"
        description="One row per size and colour. Prices include GST. Switch a variant off to stop selling it."
      >
        <VariantEditor key={variantsVersion} productId={product.id} productSlug={product.details.slug} variants={product.variants} />
      </AdminSection>

      <AdminSection
        id="images"
        title="Images"
        description="Tag images with a colour so the gallery switches when a shopper picks that colour."
      >
        <MediaManager productId={product.id} media={product.media} colours={colours} />
      </AdminSection>

      <div className="grid gap-6 lg:grid-cols-2">
        <AdminSection id="tags" title="Tags" description="Used by search.">
          <ProductTagsEditor
            key={product.tagIds.join()}
            productId={product.id}
            tags={tags.map((t) => ({ id: t.id, label: t.name }))}
            selected={product.tagIds}
          />
        </AdminSection>
        <AdminSection id="collections" title="Collections" description="New members are added at the end.">
          <ProductCollectionsEditor
            key={product.collectionIds.join()}
            productId={product.id}
            collections={collections.map((c) => ({ id: c.id, label: c.isActive ? c.title : `${c.title} (hidden)` }))}
            selected={product.collectionIds}
          />
        </AdminSection>
      </div>
    </main>
  );
}
