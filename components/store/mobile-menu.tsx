"use client";

import { useState } from "react";
import Link from "next/link";
import { Menu } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import type { NavCategory } from "@/lib/catalog/queries";

const INFO_LINKS = [
  { label: "About us", href: "/pages/about" },
  { label: "Contact", href: "/pages/contact" },
  { label: "Shipping policy", href: "/pages/shipping-policy" },
  { label: "Returns & refunds", href: "/pages/return-refund-policy" },
];

export function MobileMenu({ categories }: { categories: NavCategory[] }) {
  const [open, setOpen] = useState(false);
  const close = () => setOpen(false);

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <Button variant="ghost" size="icon" className="lg:hidden" aria-label="Open menu">
          <Menu />
        </Button>
      </SheetTrigger>
      <SheetContent side="left" className="w-[85%] max-w-sm overflow-y-auto">
        <SheetHeader className="border-b border-border">
          <SheetTitle>Shop</SheetTitle>
        </SheetHeader>
        <nav aria-label="Mobile" className="flex flex-col px-2 pb-6">
          <MenuLink href="/collections/new-arrivals" onNavigate={close}>
            New Arrivals
          </MenuLink>
          <MenuLink href="/collections/best-sellers" onNavigate={close}>
            Best Sellers
          </MenuLink>
          {categories.map((c) => (
            <div key={c.slug} className="border-t border-border/60">
              <MenuLink href={`/collections/${c.slug}`} onNavigate={close}>
                {c.name}
              </MenuLink>
              {c.children.length > 0 && (
                <ul className="pb-2 pl-4">
                  {c.children.map((child) => (
                    <li key={child.slug}>
                      <MenuLink href={`/collections/${child.slug}`} onNavigate={close} subtle>
                        {child.name}
                      </MenuLink>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          ))}
          <ul className="mt-4 border-t border-border pt-4">
            {INFO_LINKS.map((l) => (
              <li key={l.href}>
                <MenuLink href={l.href} onNavigate={close} subtle>
                  {l.label}
                </MenuLink>
              </li>
            ))}
          </ul>
        </nav>
      </SheetContent>
    </Sheet>
  );
}

function MenuLink({
  href,
  children,
  onNavigate,
  subtle = false,
}: {
  href: string;
  children: React.ReactNode;
  onNavigate: () => void;
  subtle?: boolean;
}) {
  return (
    <Link
      href={href}
      onClick={onNavigate}
      className={
        subtle
          ? "flex min-h-touch items-center rounded-md px-3 text-sm text-muted-foreground outline-none hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/60"
          : "flex min-h-touch items-center rounded-md px-3 font-heading text-lg font-semibold outline-none hover:text-primary focus-visible:ring-3 focus-visible:ring-ring/60"
      }
    >
      {children}
    </Link>
  );
}
