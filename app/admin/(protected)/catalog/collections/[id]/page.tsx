import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ExternalLink } from "lucide-react";
import { z } from "zod";
import { CollectionForm } from "@/components/admin/collection-form";
import { CollectionProducts } from "@/components/admin/collection-products";
import { DeleteButton } from "@/components/admin/delete-button";
import { AdminSection, PageHeader } from "@/components/admin/page-parts";
import { Button } from "@/components/ui/button";
import { getAdminCollection } from "@/lib/catalog/admin-queries";

export const metadata: Metadata = { title: "Edit collection" };

const paramsSchema = z.object({ id: z.uuid() });

export default async function EditCollectionPage({ params }: PageProps<"/admin/catalog/collections/[id]">) {
  const parsed = paramsSchema.safeParse(await params);
  if (!parsed.success) notFound();
  const data = await getAdminCollection(parsed.data.id);
  if (!data) notFound();
  const { collection, products } = data;

  return (
    <main className="flex flex-col gap-4 md:gap-6">
      <PageHeader
        title={collection.title}
        crumbs={[{ label: "Catalog" }, { label: "Collections", href: "/admin/catalog/collections" }]}
        actions={
          collection.isActive ? (
            <Button asChild variant="link" size="sm" className="px-0">
              <Link href={`/collections/${collection.slug}`} target="_blank">
                View in store <ExternalLink aria-hidden />
                <span className="sr-only">(opens in a new tab)</span>
              </Link>
            </Button>
          ) : undefined
        }
      />

      <div className="grid gap-6 lg:grid-cols-[minmax(0,2fr)_minmax(0,3fr)]">
        <AdminSection id="details" title="Details">
          <CollectionForm key={JSON.stringify(collection)} collection={collection} />
        </AdminSection>
        <AdminSection
          id="products"
          title="Products"
          description="Shown in this order on the collection page when sorted by Featured. Only active products appear."
        >
          <CollectionProducts key={products.map((p) => p.id).join()} collectionId={collection.id} products={products} />
        </AdminSection>
      </div>

      <div className="flex justify-end">
        <DeleteButton kind="collection" id={collection.id} name={collection.title} withLabel />
      </div>
    </main>
  );
}
