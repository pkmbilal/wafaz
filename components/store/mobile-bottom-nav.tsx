"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Home, LayoutGrid, Search, ShoppingBag, User } from "lucide-react";
import { cn } from "cn";

const ITEMS = [
  { label: "Home", href: "/", icon: Home, match: (p: string) => p === "/" },
  { label: "Shop", href: "/collections/new-arrivals", icon: LayoutGrid, match: (p: string) => p.startsWith("/collections") || p.startsWith("/products") },
  { label: "Search", href: "/search", icon: Search, match: (p: string) => p.startsWith("/search") },
  { label: "Cart", href: "/cart", icon: ShoppingBag, match: (p: string) => p.startsWith("/cart") },
  { label: "Account", href: "/account", icon: User, match: (p: string) => p.startsWith("/account") },
];

export function MobileBottomNav() {
  const pathname = usePathname();

  return (
    <nav
      aria-label="Quick links"
      className="fixed inset-x-0 bottom-0 z-40 border-t border-border bg-background/95 pb-[env(safe-area-inset-bottom)] backdrop-blur md:hidden"
    >
      <ul className="grid grid-cols-5">
        {ITEMS.map(({ label, href, icon: Icon, match }) => {
          const active = match(pathname);
          return (
            <li key={href}>
              <Link
                href={href}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "flex h-14 flex-col items-center justify-center gap-0.5 text-[0.6875rem] font-medium outline-none focus-visible:bg-muted",
                  active ? "text-primary" : "text-muted-foreground",
                )}
              >
                <Icon aria-hidden className="size-5" strokeWidth={active ? 2.25 : 1.75} />
                {label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
