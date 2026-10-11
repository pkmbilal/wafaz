import Image from "next/image";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
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

      <section aria-labelledby="shop-by-category" className="mx-auto w-full max-w-7xl px-4 pt-20 lg:px-6 lg:pt-28">
        <SectionHeading id="shop-by-category" eyebrow="Explore" title="Shop by category" />
        <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5 lg:gap-5">
          {categories.map((c) => (
            <li key={c.slug}>
              <Link
                href={`/collections/${c.slug}`}
                className="group relative block overflow-hidden outline-none focus-visible:ring-3 focus-visible:ring-ring/60"
              >
                <div className="relative aspect-4/5 w-full bg-muted">
                  {c.imageKey && (
                    <Image
                      src={mediaUrl(c.imageKey)}
                      alt=""
                      fill
                      sizes="(min-width: 1024px) 20vw, (min-width: 640px) 33vw, 50vw"
                      className="object-cover transition-transform duration-700 ease-out group-hover:scale-[1.03]"
                    />
                  )}
                  {/* Scrim keeps the caption legible on any photo. */}
                  <div aria-hidden className="absolute inset-x-0 bottom-0 h-1/2 bg-linear-to-t from-ink/60 to-transparent" />
                </div>
                <span className="absolute inset-x-0 bottom-0 flex flex-col items-center gap-1 p-4 text-ink-foreground">
                  <span className="font-heading text-xl sm:text-2xl">{c.name}</span>
                  <span className="eyebrow link-underline text-ink-foreground/85">Shop now</span>
                </span>
              </Link>
            </li>
          ))}
        </ul>
      </section>

      <ProductRail id="new-arrivals" eyebrow="Just in" title="New Arrivals" href="/collections/new-arrivals" products={newArrivals} />

      <BrandStory />

      <ProductRail id="best-sellers" eyebrow="Most loved" title="Best Sellers" href="/collections/best-sellers" products={bestSellers} />
    </>
  );
}

function SectionHeading({ id, eyebrow, title }: { id: string; eyebrow: string; title: string }) {
  return (
    <div className="mb-10 flex flex-col items-center gap-3 text-center lg:mb-12">
      <p className="eyebrow text-muted-foreground">{eyebrow}</p>
      <h2 id={id} className="text-4xl sm:text-5xl">
        {title}
      </h2>
      <span aria-hidden className="h-px w-12 bg-accent" />
    </div>
  );
}

// TODO(owner): brand story copy.
function BrandStory() {
  return (
    <section aria-labelledby="our-story" className="mt-20 bg-secondary lg:mt-28">
      <div className="mx-auto flex w-full max-w-3xl flex-col items-center gap-5 px-4 py-20 text-center lg:py-28">
        <p className="eyebrow text-muted-foreground">Our story</p>
        <h2 id="our-story" className="text-3xl leading-tight italic sm:text-4xl">
          Everyday ethnic wear, made with care and designed to be worn and loved.
        </h2>
        <span aria-hidden className="h-px w-12 bg-accent" />
        <Link
          href="/pages/about"
          className="inline-flex min-h-touch items-center eyebrow text-foreground outline-none focus-visible:ring-3 focus-visible:ring-ring/60"
        >
          <span className="link-underline">Read more</span>
        </Link>
      </div>
    </section>
  );
}

function ProductRail({
  id,
  eyebrow,
  title,
  href,
  products,
}: {
  id: string;
  eyebrow: string;
  title: string;
  href: string;
  products: ProductCardData[];
}) {
  if (products.length === 0) return null;

  return (
    <section aria-labelledby={id} className="mx-auto w-full max-w-7xl px-4 pt-20 lg:px-6 lg:pt-28">
      <SectionHeading id={id} eyebrow={eyebrow} title={title} />
      <ProductGrid products={products} />
      <div className="mt-12 flex justify-center">
        <Button asChild variant="outline" size="lg">
          <Link href={href}>
            View all
            <ArrowRight aria-hidden className="size-3.5" />
          </Link>
        </Button>
      </div>
    </section>
  );
}
