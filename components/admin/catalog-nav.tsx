"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "cn";

const ITEMS = [
  { label: "Categories", href: "/admin/catalog/categories" },
  { label: "Collections", href: "/admin/catalog/collections" },
  { label: "Tags", href: "/admin/catalog/tags" },
  { label: "Size charts", href: "/admin/catalog/size-charts" },
  { label: "Banners", href: "/admin/catalog/banners" },
] as const;

export function CatalogNav() {
  const pathname = usePathname();
  return (
    <nav aria-label="Catalog">
      <ul className="flex gap-1 overflow-x-auto border-b border-border">
        {ITEMS.map(({ label, href }) => {
          const active = pathname.startsWith(href);
          return (
            <li key={href}>
              <Link
                href={href}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "flex min-h-touch items-center border-b-2 px-3 text-sm font-medium whitespace-nowrap transition-colors outline-none focus-visible:ring-3 focus-visible:ring-ring/60",
                  active ? "border-primary text-primary" : "border-transparent text-foreground/70 hover:text-primary",
                )}
              >
                {label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
