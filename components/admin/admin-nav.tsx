"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { LayoutDashboard, Package, Store } from "lucide-react";
import { cn } from "cn";
import { STORE_NAME } from "@/lib/site";

const ITEMS = [
  { label: "Dashboard", href: "/admin", icon: LayoutDashboard },
  { label: "Orders", href: "/admin/orders", icon: Package },
] as const;

export function AdminNav() {
  const pathname = usePathname();

  return (
    <header className="border-b border-border bg-card">
      <div className="mx-auto flex w-full max-w-6xl items-center gap-2 px-4">
        <span className="mr-2 hidden font-heading text-xl font-semibold text-primary sm:inline">{STORE_NAME} admin</span>
        <nav aria-label="Admin" className="min-w-0 flex-1">
          <ul className="flex gap-1 overflow-x-auto">
            {ITEMS.map(({ label, href, icon: Icon }) => {
              const active = href === "/admin" ? pathname === href : pathname.startsWith(href);
              return (
                <li key={href}>
                  <Link
                    href={href}
                    aria-current={active ? "page" : undefined}
                    className={cn(
                      "flex min-h-touch items-center gap-2 border-b-2 px-3 text-sm font-medium whitespace-nowrap transition-colors outline-none focus-visible:ring-3 focus-visible:ring-ring/60",
                      active ? "border-primary text-primary" : "border-transparent text-foreground/70 hover:text-primary",
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
        <Link
          href="/"
          className="flex min-h-touch items-center gap-2 rounded-md px-3 text-sm text-foreground/70 outline-none hover:text-primary focus-visible:ring-3 focus-visible:ring-ring/60"
        >
          <Store aria-hidden className="size-4" />
          <span className="sr-only sm:not-sr-only">View store</span>
        </Link>
      </div>
    </header>
  );
}
