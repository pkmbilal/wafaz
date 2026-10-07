import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Breadcrumbs } from "@/components/store/breadcrumbs";
import { ProductView } from "@/components/store/product-view";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { getProduct, getStaticSlugs, getVariantAvailability, type Product } from "@/lib/catalog/queries";
import { publicEnv } from "@/lib/env";
import { mediaUrl } from "@/lib/r2";
import { STORE_NAME } from "@/lib/site";

export async function generateStaticParams() {
  const { products } = await getStaticSlugs();
  return products.map((slug) => ({ slug }));
}

export async function generateMetadata({ params }: PageProps<"/products/[slug]">): Promise<Metadata> {
  const { slug } = await params;
  const product = await getProduct(slug);
  if (!product) return {};
  return {
    title: product.seoTitle ?? product.title,
    description: product.seoDescription ?? product.description ?? undefined,
    alternates: { canonical: `/products/${product.slug}` },
    openGraph: {
      title: product.title,
      images: product.media[0] ? [absoluteUrl(mediaUrl(product.media[0].key))] : undefined,
    },
  };
}

export default async function ProductPage({ params }: PageProps<"/products/[slug]">) {
  const { slug } = await params;
  const product = await getProduct(slug);
  if (!product) notFound();

  // Not awaited: the size selector streams it in, the rest of the page is prerendered.
  const availability = getVariantAvailability(product.id);

  return (
    <div className="mx-auto w-full max-w-7xl px-4 py-8 lg:px-6">
      <ProductJsonLd product={product} />
      <Breadcrumbs items={product.breadcrumb} current={product.title} />

      <ProductView product={product} availability={availability} />

      <Accordion type="multiple" defaultValue={["description"]} className="mt-10 max-w-3xl border-t border-border">
        {product.description && (
          <AccordionItem value="description">
            <AccordionTrigger>Description</AccordionTrigger>
            <AccordionContent>
              <p>{product.description}</p>
            </AccordionContent>
          </AccordionItem>
        )}
        <AccordionItem value="details">
          <AccordionTrigger>Product details</AccordionTrigger>
          <AccordionContent>
            <dl className="grid grid-cols-[auto_1fr] gap-x-6 gap-y-2">
              <Detail label="Fabric" value={product.fabric} />
              <Detail label="Style" value={product.style} />
              <Detail label="Occasion" value={product.occasion} />
              <Detail label="Country of origin" value={product.countryOfOrigin} />
            </dl>
          </AccordionContent>
        </AccordionItem>
        {product.care && (
          <AccordionItem value="care">
            <AccordionTrigger>Care</AccordionTrigger>
            <AccordionContent>
              <p>{product.care}</p>
            </AccordionContent>
          </AccordionItem>
        )}
      </Accordion>
    </div>
  );
}

function Detail({ label, value }: { label: string; value: string | null }) {
  if (!value) return null;
  return (
    <>
      <dt className="font-medium text-foreground">{label}</dt>
      <dd>{value}</dd>
    </>
  );
}

function absoluteUrl(url: string) {
  return url.startsWith("/") ? `${publicEnv.NEXT_PUBLIC_SITE_URL}${url}` : url;
}

// Availability is deliberately omitted: it changes faster than this page's cache.
function ProductJsonLd({ product }: { product: Product }) {
  const prices = product.variants.map((v) => v.pricePaise);
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "Product",
    name: product.title,
    description: product.description ?? undefined,
    image: product.media.slice(0, 4).map((m) => absoluteUrl(mediaUrl(m.key))),
    brand: { "@type": "Brand", name: STORE_NAME },
    material: product.fabric ?? undefined,
    countryOfOrigin: product.countryOfOrigin,
    offers:
      prices.length > 0
        ? {
            "@type": "AggregateOffer",
            priceCurrency: "INR",
            lowPrice: (Math.min(...prices) / 100).toFixed(2),
            highPrice: (Math.max(...prices) / 100).toFixed(2),
            offerCount: product.variants.length,
          }
        : undefined,
  };

  return (
    <script
      type="application/ld+json"
      // Escape "<" so product text can never close the script tag.
      dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd).replace(/</g, "\\u003c") }}
    />
  );
}
