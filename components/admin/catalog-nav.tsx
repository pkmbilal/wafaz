"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "cn";

// Shared with the sidebar's Catalog sub-menu.
export const CATALOG_ITEMS = [
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
      <ul className="flex gap-1 overflow-x-auto rounded-xl [scrollbar-width:none] border border-border bg-card p-1.5 shadow-soft">
        {CATALOG_ITEMS.map(({ label, href }) => {
          const active = pathname.startsWith(href);
          return (
            <li key={href}>
              <Link
                href={href}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "flex min-h-touch items-center rounded-lg px-4 text-sm font-medium whitespace-nowrap transition-colors outline-none focus-visible:ring-3 focus-visible:ring-ring/60",
                  active ? "bg-primary/10 text-primary" : "text-foreground/70 hover:bg-muted hover:text-foreground",
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
