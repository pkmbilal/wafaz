import Image from "next/image";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { HeroBanners } from "@/components/store/hero-banners";
import { ProductGrid } from "@/components/store/product-card";
import { getHomeData } from "@/lib/catalog/queries";
import { mediaUrl } from "@/lib/r2";
import type { ProductCardData } from "@/lib/catalog/queries";

export default async function HomePage() {
  const { banners, categories, newArrivals, bestSellers } = await getHomeData();

  return (
    <>
      <HeroBanners banners={banners} />

      <section aria-labelledby="shop-by-category" className="mx-auto w-full max-w-7xl px-4 pt-12 lg:px-6">
        <h2 id="shop-by-category" className="mb-6 text-center text-3xl font-semibold sm:text-4xl">
          Shop by category
        </h2>
        <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5 lg:gap-6">
          {categories.map((c) => (
            <li key={c.slug}>
              <Link
                href={`/collections/${c.slug}`}
                className="group flex flex-col items-center gap-2 rounded-md outline-none focus-visible:ring-3 focus-visible:ring-ring/60"
              >
                <div className="relative aspect-4/5 w-full overflow-hidden rounded-md bg-muted">
                  {c.imageKey && (
                    <Image
                      src={mediaUrl(c.imageKey)}
                      alt=""
                      fill
                      sizes="(min-width: 1024px) 20vw, (min-width: 640px) 33vw, 50vw"
                      className="object-cover transition-transform duration-500 group-hover:scale-[1.03]"
                    />
                  )}
                </div>
                <span className="font-heading text-xl font-semibold">{c.name}</span>
              </Link>
            </li>
          ))}
        </ul>
      </section>

      <ProductRail id="new-arrivals" title="New Arrivals" href="/collections/new-arrivals" products={newArrivals} />
      <ProductRail id="best-sellers" title="Best Sellers" href="/collections/best-sellers" products={bestSellers} />
    </>
  );
}

function ProductRail({
  id,
  title,
  href,
  products,
}: {
  id: string;
  title: string;
  href: string;
  products: ProductCardData[];
}) {
  if (products.length === 0) return null;

  return (
    <section aria-labelledby={id} className="mx-auto w-full max-w-7xl px-4 pt-16 lg:px-6">
      <div className="mb-6 flex items-end justify-between gap-4">
        <h2 id={id} className="text-3xl font-semibold sm:text-4xl">
          {title}
        </h2>
        <Link
          href={href}
          className="inline-flex min-h-touch items-center gap-1 text-sm font-medium text-primary underline-offset-4 outline-none hover:underline focus-visible:ring-3 focus-visible:ring-ring/60"
        >
          View all
          <ArrowRight aria-hidden className="size-4" />
        </Link>
      </div>
      <ProductGrid products={products} />
    </section>
  );
}
