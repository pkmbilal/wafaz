"use client";

import { Suspense, useState, useTransition } from "react";
import { ShoppingBag } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useCart } from "@/components/store/cart-provider";
import { ColourSwatch } from "@/components/store/colour-swatch";
import { PriceTag } from "@/components/store/price-tag";
import { ProductGallery } from "@/components/store/product-gallery";
import { SizeChart } from "@/components/store/size-chart";
import { SizeSelector, SizeSelectorSkeleton } from "@/components/store/size-selector";
import type { Product } from "@/lib/catalog/queries";

type ProductViewProps = {
  product: Pick<Product, "title" | "colours" | "variants" | "media" | "sizeChart">;
  // Fresh-ish stock per variant; streamed in so the rest of the page stays cached.
  availability: Promise<Record<string, number>>;
};

export function ProductView({ product, availability }: ProductViewProps) {
  const [colour, setColour] = useState(product.colours[0]?.name ?? "");
  const [variantId, setVariantId] = useState<string | null>(null);
  const [adding, startAdding] = useTransition();
  const cart = useCart();

  const colourVariants = product.variants.filter((v) => v.colour === colour);
  const selected = colourVariants.find((v) => v.id === variantId) ?? null;
  const cheapest = colourVariants.reduce<(typeof colourVariants)[number] | null>(
    (min, v) => (min === null || v.pricePaise < min.pricePaise ? v : min),
    null,
  );
  const shown = selected ?? cheapest;

  const colourMedia = product.media.filter((m) => m.colour === null || m.colour === colour);
  const media = colourMedia.length > 0 ? colourMedia : product.media;

  return (
    <div className="grid gap-8 lg:grid-cols-2 lg:gap-12">
      {/* Remount on colour change so the gallery starts at that colour's first image. */}
      <ProductGallery key={colour} media={media} title={product.title} />

      <div className="flex flex-col gap-6">
        <div className="flex flex-col gap-2">
          <h1 className="text-3xl leading-tight font-semibold sm:text-4xl">{product.title}</h1>
          {shown && <PriceTag pricePaise={shown.pricePaise} mrpPaise={shown.mrpPaise} size="lg" />}
          <p className="text-xs text-muted-foreground">Inclusive of all taxes</p>
        </div>

        {product.colours.length > 0 && (
          <ColourSwatch
            colours={product.colours}
            value={colour}
            onChange={(c) => {
              setColour(c);
              setVariantId(null);
            }}
          />
        )}

        <div className="flex flex-col gap-1">
          <Suspense fallback={<SizeSelectorSkeleton count={colourVariants.length} />}>
            <SizeSelector
              key={colour}
              options={colourVariants.map((v) => ({ size: v.size, variantId: v.id }))}
              availability={availability}
              value={variantId}
              onChange={setVariantId}
            />
          </Suspense>
          {product.sizeChart && <SizeChart name={product.sizeChart.name} data={product.sizeChart.data} />}
        </div>

        {/* The size selector only allows in-stock sizes; the server re-checks stock on add. */}
        <div className="flex flex-col gap-2">
          <Button
            size="lg"
            disabled={!selected || adding}
            aria-disabled={!selected || adding}
            className="w-full sm:max-w-sm"
            onClick={() => {
              if (!selected) return;
              startAdding(async () => {
                await cart.add(selected.id, 1);
              });
            }}
          >
            <ShoppingBag />
            {adding ? "Adding…" : "Add to cart"}
          </Button>
          {!selected && <p className="text-xs text-muted-foreground">Select a size to continue.</p>}
        </div>
      </div>
    </div>
  );
}
