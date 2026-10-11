import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { Breadcrumbs } from "@/components/store/breadcrumbs";
import { ListingResults, ListingSkeleton } from "@/components/store/listing-results";
import { getListingTarget, getStaticSlugs, type ListingScope } from "@/lib/catalog/queries";
import type { SortOption } from "@/lib/validators/catalog";

const SORT_OPTIONS: SortOption[] = ["featured", "newest", "price_asc", "price_desc"];

export async function generateStaticParams() {
  const { listings } = await getStaticSlugs();
  return listings.map((slug) => ({ slug }));
}

export async function generateMetadata({ params }: PageProps<"/collections/[slug]">): Promise<Metadata> {
  const { slug } = await params;
  const target = await getListingTarget(slug);
  if (!target) return {};
  return {
    title: target.title,
    description: target.description ?? `Shop ${target.title.toLowerCase()} online. Prices include GST.`,
    // Filtered / sorted / paginated variants all canonicalise to the clean listing URL.
    alternates: { canonical: `/collections/${target.slug}` },
  };
}

export default async function CollectionPage({ params, searchParams }: PageProps<"/collections/[slug]">) {
  const { slug } = await params;
  const target = await getListingTarget(slug);
  if (!target) notFound();

  const scope: ListingScope =
    target.kind === "collection" ? { collectionSlug: target.slug } : { categorySlug: target.slug };

  return (
    <div className="mx-auto w-full max-w-7xl px-4 py-8 lg:px-6">
      <Breadcrumbs items={target.breadcrumb} />
      <header className="mb-10 flex flex-col items-center gap-3 text-center lg:mb-14">
        <h1 className="text-4xl sm:text-5xl">{target.title}</h1>
        <span aria-hidden className="h-px w-12 bg-accent" />
        {target.description && <p className="max-w-2xl leading-relaxed text-muted-foreground">{target.description}</p>}
      </header>

      <Suspense fallback={<ListingSkeleton />}>
        <ListingResults
          scope={scope}
          searchParams={searchParams}
          basePath={`/collections/${target.slug}`}
          defaultSort="featured"
          sortOptions={SORT_OPTIONS}
        />
      </Suspense>
    </div>
  );
}
