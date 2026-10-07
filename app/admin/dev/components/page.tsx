import { notFound } from "next/navigation";
import { Heart } from "lucide-react";
import { Button } from "@/components/ui/button";

const variants = ["default", "festive", "outline", "secondary", "ghost", "destructive", "link"] as const;
const sizes = ["sm", "default", "lg"] as const;

// Dev-only showcase of every UI primitive and variant (AGENTS.md §6).
export default function ComponentShowcasePage() {
  if (process.env.NODE_ENV === "production") notFound();

  return (
    <main className="mx-auto w-full max-w-5xl space-y-12 px-4 py-10">
      <header className="space-y-1">
        <h1 className="text-3xl font-semibold">Components</h1>
        <p className="text-sm text-muted-foreground">Every primitive and variant. Dev only.</p>
      </header>

      <section className="space-y-4">
        <h2 className="text-2xl font-semibold">Button</h2>
        {sizes.map((size) => (
          <div key={size} className="flex flex-wrap items-center gap-3">
            {variants.map((variant) => (
              <Button key={variant} variant={variant} size={size}>
                {variant}
              </Button>
            ))}
          </div>
        ))}
        <div className="flex flex-wrap items-center gap-3">
          <Button size="icon" variant="outline" aria-label="Add to wishlist">
            <Heart />
          </Button>
          <Button disabled>Disabled</Button>
        </div>
      </section>
    </main>
  );
}
