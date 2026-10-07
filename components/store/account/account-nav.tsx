"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { MapPin, Package, UserRound } from "lucide-react";
import { cn } from "cn";

const ITEMS = [
  { label: "Profile", href: "/account", icon: UserRound },
  { label: "Addresses", href: "/account/addresses", icon: MapPin },
  { label: "Orders", href: "/account/orders", icon: Package },
] as const;

export function AccountNav() {
  const pathname = usePathname();

  return (
    <nav aria-label="Account" className="md:w-48 md:shrink-0">
      <ul className="flex gap-1 overflow-x-auto border-b border-border md:flex-col md:border-b-0">
        {ITEMS.map(({ label, href, icon: Icon }) => {
          const active = href === "/account" ? pathname === href : pathname.startsWith(href);
          return (
            <li key={href}>
              <Link
                href={href}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "flex min-h-touch items-center gap-2 border-b-2 px-3 text-sm font-medium tracking-wide whitespace-nowrap transition-colors outline-none focus-visible:ring-3 focus-visible:ring-ring/60 md:rounded-md md:border-b-0",
                  active
                    ? "border-primary text-primary md:bg-secondary"
                    : "border-transparent text-foreground/70 hover:text-primary",
                )}
              >
                <Icon aria-hidden className="size-4" />
                {label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
