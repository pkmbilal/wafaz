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
    <article className="group relative flex flex-col gap-2">
      <div className="relative aspect-4/5 overflow-hidden rounded-md bg-muted">
        {product.imageKey ? (
          <Image
            src={mediaUrl(product.imageKey)}
            alt={product.imageAlt ?? product.title}
            fill
            sizes="(min-width: 1024px) 25vw, (min-width: 768px) 33vw, 50vw"
            loading={eager ? "eager" : "lazy"}
            className="object-cover transition-transform duration-500 group-hover:scale-[1.03]"
          />
        ) : null}
        <div className="absolute top-2 left-2 flex flex-col items-start gap-1">
          {!product.inStock && <Badge variant="soldout">Sold out</Badge>}
          {product.inStock && product.isNew && <Badge variant="new">New</Badge>}
          {product.inStock && onSale && <Badge variant="sale">Sale</Badge>}
        </div>
      </div>

      <div className="flex flex-col gap-1">
        <h3 className="font-sans text-sm leading-snug font-medium tracking-normal text-foreground">
          {/* The stretched link makes the whole card clickable with a single tab stop. */}
          <Link href={`/products/${product.slug}`} className="outline-none after:absolute after:inset-0 after:rounded-md focus-visible:after:ring-3 focus-visible:after:ring-ring/60">
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
                className="size-3.5 rounded-full border border-border"
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
    <ul className="grid grid-cols-2 gap-x-3 gap-y-8 md:grid-cols-3 lg:grid-cols-4 lg:gap-x-6">
      {products.map((p, i) => (
        <li key={p.id}>
          <ProductCard product={p} eager={i < eagerCount} />
        </li>
      ))}
    </ul>
  );
}
