import Image from "next/image";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { PriceTag } from "@/components/store/price-tag";
import { mediaUrl } from "@/lib/r2";
import type { ProductCardData } from "@/lib/catalog/queries";

type ProductCardProps = {
  product: ProductCardData;
  // Above-the-fold cards load eagerly; the rest stay lazy.
  eager?: boolean;
};

export function ProductCard({ product, eager = false }: ProductCardProps) {
  const onSale = product.pricePaise < product.mrpPaise;

  return (
    <article className="group relative flex flex-col gap-3">
      <div className="relative aspect-4/5 overflow-hidden bg-muted">
        {product.imageKey ? (
          <Image
            src={mediaUrl(product.imageKey)}
            alt={product.imageAlt ?? product.title}
            fill
            sizes="(min-width: 1024px) 25vw, (min-width: 768px) 33vw, 50vw"
            loading={eager ? "eager" : "lazy"}
            className="object-cover transition-transform duration-700 ease-out group-hover:scale-[1.02]"
          />
        ) : null}
        <div className="absolute top-3 left-3 flex flex-col items-start gap-1">
          {!product.inStock && <Badge variant="soldout">Sold out</Badge>}
          {product.inStock && product.isNew && <Badge variant="new">New</Badge>}
          {product.inStock && onSale && <Badge variant="sale">Sale</Badge>}
        </div>
      </div>

      <div className="flex flex-col gap-1.5">
        <h3 className="font-sans text-[0.8125rem] leading-snug font-normal tracking-wide text-foreground/90">
          {/* The stretched link makes the whole card clickable with a single tab stop. */}
          <Link href={`/products/${product.slug}`} className="outline-none after:absolute after:inset-0 focus-visible:after:ring-3 focus-visible:after:ring-ring/60">
            {product.title}
          </Link>
        </h3>
        <PriceTag pricePaise={product.pricePaise} mrpPaise={product.mrpPaise} />
        {product.colours.length > 1 && (
          <ul className="flex items-center gap-1.5" aria-label={`${product.colours.length} colours`}>
            {product.colours.slice(0, 5).map((c) => (
              <li
                key={c.name}
                title={c.name}
                className="size-3 rounded-full ring-1 ring-border ring-offset-1"
                // Colour values come from product data, not the design system.
                style={{ backgroundColor: c.hex ?? undefined }}
              />
            ))}
          </ul>
        )}
      </div>
    </article>
  );
}

export function ProductGrid({
  products,
  eagerCount = 0,
}: {
  products: ProductCardData[];
  eagerCount?: number;
}) {
  return (
    <ul className="grid grid-cols-2 gap-x-3 gap-y-10 md:grid-cols-3 lg:grid-cols-4 lg:gap-x-8 lg:gap-y-14">
      {products.map((p, i) => (
        <li key={p.id}>
          <ProductCard product={p} eager={i < eagerCount} />
        </li>
      ))}
    </ul>
  );
}
