"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  ChevronDown,
  FolderTree,
  LayoutDashboard,
  type LucideIcon,
  Package,
  Settings,
  Shirt,
  Store,
  TicketPercent,
} from "lucide-react";
import { cn } from "cn";
import { useAdminShell } from "@/components/admin/admin-shell";
import { CATALOG_ITEMS } from "@/components/admin/catalog-nav";
import { Sheet, SheetContent, SheetDescription, SheetTitle } from "@/components/ui/sheet";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { STORE_NAME } from "@/lib/site";

// TailAdmin-style sidebar in the store's colours: fixed on desktop (collapsible to icons),
// a left drawer on phones.

type NavItem = { label: string; href: string; icon: LucideIcon; children?: readonly { label: string; href: string }[] };

const ITEMS: readonly NavItem[] = [
  { label: "Dashboard", href: "/admin", icon: LayoutDashboard },
  { label: "Orders", href: "/admin/orders", icon: Package },
  { label: "Products", href: "/admin/products", icon: Shirt },
  { label: "Catalog", href: "/admin/catalog", icon: FolderTree, children: CATALOG_ITEMS },
  { label: "Coupons", href: "/admin/coupons", icon: TicketPercent },
  { label: "Settings", href: "/admin/settings", icon: Settings },
];

export const SIDEBAR_ID = "admin-sidebar";

function isActive(pathname: string, href: string): boolean {
  return href === "/admin" ? pathname === href : pathname === href || pathname.startsWith(`${href}/`);
}

const itemClass = (active: boolean) =>
  cn(
    "flex min-h-touch w-full items-center gap-3 rounded-lg px-3 text-sm font-medium transition-colors outline-none focus-visible:ring-3 focus-visible:ring-ring/60",
    active ? "bg-primary/10 text-primary" : "text-foreground/70 hover:bg-muted hover:text-foreground",
  );

export function AdminSidebar() {
  const { collapsed, mobileOpen, setMobileOpen } = useAdminShell();

  return (
    <>
      <aside
        id={SIDEBAR_ID}
        aria-label="Admin"
        className={cn(
          "fixed inset-y-0 left-0 z-40 hidden flex-col border-r border-border bg-card transition-[width] duration-200 lg:flex",
          collapsed ? "w-sidebar-collapsed" : "w-sidebar",
        )}
      >
        <SidebarContent collapsed={collapsed} />
      </aside>

      <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
        <SheetContent side="left" className="w-sidebar max-w-[85vw] gap-0 p-0 sm:max-w-sidebar [&>[data-slot=sheet-close]]:top-4 [&>[data-slot=sheet-close]]:text-ink-foreground [&>[data-slot=sheet-close]]:hover:bg-ink-foreground/10">
          <SheetTitle className="sr-only">Admin menu</SheetTitle>
          <SheetDescription className="sr-only">Navigate the admin area</SheetDescription>
          <SidebarContent collapsed={false} onNavigate={() => setMobileOpen(false)} />
        </SheetContent>
      </Sheet>
    </>
  );
}

function SidebarContent({ collapsed, onNavigate }: { collapsed: boolean; onNavigate?: () => void }) {
  const pathname = usePathname();

  return (
    <TooltipProvider delayDuration={150}>
      <div className="flex h-admin-header shrink-0 items-center border-b border-border bg-ink px-5 text-ink-foreground">
        <Link
          href="/admin"
          onClick={onNavigate}
          className={cn(
            "flex min-h-touch items-center gap-3 rounded-sm outline-none focus-visible:ring-3 focus-visible:ring-accent/70",
            collapsed && "w-full justify-center",
          )}
        >
          <span
            aria-hidden
            className="flex size-9 shrink-0 items-center justify-center rounded-lg border border-accent/60 font-heading text-xl text-accent"
          >
            {STORE_NAME.charAt(0)}
          </span>
          {!collapsed && (
            <span className="flex flex-col leading-none">
              <span className="font-heading text-2xl">{STORE_NAME}</span>
              <span className="eyebrow mt-1 text-accent">Admin</span>
            </span>
          )}
          {collapsed && <span className="sr-only">{STORE_NAME} admin</span>}
        </Link>
      </div>

      <nav aria-label="Admin sections" className="flex-1 overflow-y-auto px-4 py-6">
        <p className={cn("eyebrow mb-3 px-3 text-muted-foreground", collapsed && "sr-only")}>Menu</p>
        <ul className="flex flex-col gap-1">
          {ITEMS.map((item) =>
            item.children && !collapsed ? (
              <GroupItem key={item.href} item={item} pathname={pathname} onNavigate={onNavigate} />
            ) : (
              <li key={item.href}>
                <NavLink item={item} active={isActive(pathname, item.href)} collapsed={collapsed} onNavigate={onNavigate} />
              </li>
            ),
          )}
        </ul>
      </nav>

      <div className="shrink-0 border-t border-border p-4">
        <NavLink
          item={{ label: "View store", href: "/", icon: Store }}
          active={false}
          collapsed={collapsed}
          onNavigate={onNavigate}
        />
      </div>
    </TooltipProvider>
  );
}

function NavLink({
  item,
  active,
  collapsed,
  onNavigate,
}: {
  item: NavItem;
  active: boolean;
  collapsed: boolean;
  onNavigate?: () => void;
}) {
  const { label, href, icon: Icon } = item;
  const link = (
    <Link
      href={href}
      onClick={onNavigate}
      aria-current={active ? "page" : undefined}
      className={cn(itemClass(active), collapsed && "justify-center px-0")}
    >
      <Icon aria-hidden className="size-5 shrink-0" />
      {collapsed ? <span className="sr-only">{label}</span> : label}
    </Link>
  );
  if (!collapsed) return link;
  return (
    <Tooltip>
      <TooltipTrigger asChild>{link}</TooltipTrigger>
      <TooltipContent side="right" sideOffset={8}>
        {label}
      </TooltipContent>
    </Tooltip>
  );
}

// A parent item with sub-links (Catalog). Opens by itself while you're inside its section.
function GroupItem({ item, pathname, onNavigate }: { item: NavItem; pathname: string; onNavigate?: () => void }) {
  const inSection = isActive(pathname, item.href);
  const [toggled, setToggled] = useState<boolean | null>(null);
  const open = toggled ?? inSection;
  const { label, icon: Icon, children = [] } = item;
  const listId = `admin-nav-${label.toLowerCase()}`;

  return (
    <li>
      <button
        type="button"
        aria-expanded={open}
        aria-controls={listId}
        onClick={() => setToggled(!open)}
        className={itemClass(inSection)}
      >
        <Icon aria-hidden className="size-5 shrink-0" />
        {label}
        <ChevronDown
          aria-hidden
          className={cn("ml-auto size-4 transition-transform duration-200", open && "rotate-180")}
        />
      </button>
      <ul id={listId} hidden={!open} className="mt-1 ml-8 flex flex-col gap-0.5 border-l border-border pl-3">
        {children.map((child) => {
          const active = isActive(pathname, child.href);
          return (
            <li key={child.href}>
              <Link
                href={child.href}
                onClick={onNavigate}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "flex min-h-touch items-center rounded-lg px-3 text-sm transition-colors outline-none focus-visible:ring-3 focus-visible:ring-ring/60",
                  active ? "font-medium text-primary" : "text-foreground/65 hover:bg-muted hover:text-foreground",
                )}
              >
                {child.label}
              </Link>
            </li>
          );
        })}
      </ul>
    </li>
  );
}
