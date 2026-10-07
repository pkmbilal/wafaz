import { notFound } from "next/navigation";
import { Heart } from "lucide-react";
import { InteractiveShowcase } from "@/components/admin/showcase-interactive";
import { Badge } from "@/components/ui/badge";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";
import { Button } from "@/components/ui/button";
import {
  Pagination,
  PaginationContent,
  PaginationEllipsis,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
} from "@/components/ui/pagination";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";

const variants = ["default", "festive", "outline", "secondary", "ghost", "destructive", "link"] as const;
const sizes = ["sm", "default", "lg"] as const;
const badgeVariants = ["default", "secondary", "outline", "destructive", "new", "sale", "soldout"] as const;

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

      <section className="space-y-4">
        <h2 className="text-2xl font-semibold">Badge</h2>
        <div className="flex flex-wrap items-center gap-3">
          {badgeVariants.map((v) => (
            <Badge key={v} variant={v}>
              {v}
            </Badge>
          ))}
        </div>
      </section>

      <section className="space-y-4">
        <h2 className="text-2xl font-semibold">Breadcrumb / Separator / Skeleton</h2>
        <Breadcrumb>
          <BreadcrumbList>
            <BreadcrumbItem>
              <BreadcrumbLink href="#">Home</BreadcrumbLink>
            </BreadcrumbItem>
            <BreadcrumbSeparator />
            <BreadcrumbItem>
              <BreadcrumbLink href="#">Kurtis</BreadcrumbLink>
            </BreadcrumbItem>
            <BreadcrumbSeparator />
            <BreadcrumbItem>
              <BreadcrumbPage>Indigo Block Print Kurti</BreadcrumbPage>
            </BreadcrumbItem>
          </BreadcrumbList>
        </Breadcrumb>
        <Separator />
        <div className="flex gap-3">
          <Skeleton className="aspect-4/5 w-32" />
          <div className="flex flex-col gap-2">
            <Skeleton className="h-4 w-40" />
            <Skeleton className="h-4 w-24" />
          </div>
        </div>
      </section>

      <section className="space-y-4">
        <h2 className="text-2xl font-semibold">Pagination</h2>
        <Pagination className="justify-start">
          <PaginationContent>
            <PaginationItem>
              <PaginationPrevious href="#" />
            </PaginationItem>
            <PaginationItem>
              <PaginationLink href="#">1</PaginationLink>
            </PaginationItem>
            <PaginationItem>
              <PaginationLink href="#" isActive>
                2
              </PaginationLink>
            </PaginationItem>
            <PaginationItem>
              <PaginationEllipsis />
            </PaginationItem>
            <PaginationItem>
              <PaginationNext href="#" />
            </PaginationItem>
          </PaginationContent>
        </Pagination>
      </section>

      <InteractiveShowcase />
    </main>
  );
}
