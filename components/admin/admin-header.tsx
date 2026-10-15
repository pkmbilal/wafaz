"use client";

import { useTransition } from "react";
import Form from "next/form";
import Link from "next/link";
import { ChevronDown, LogOut, Menu, PanelLeftClose, PanelLeftOpen, Search, Settings, Store } from "lucide-react";
import { adminSignOut } from "@/app/admin/(protected)/actions";
import { useAdminShell } from "@/components/admin/admin-shell";
import { SIDEBAR_ID } from "@/components/admin/admin-sidebar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import type { StaffRole } from "@/lib/auth/guards";

// TailAdmin-style top bar: sidebar toggle, order search and the signed-in user's menu.
// TODO(owner): a notifications bell needs a data source (e.g. new orders) before it's worth adding.

const iconButton =
  "flex size-touch shrink-0 items-center justify-center rounded-lg border border-border text-foreground/70 transition-colors outline-none hover:bg-muted hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/60";

export function AdminHeader({ email, role }: { email: string | null; role: StaffRole }) {
  const { collapsed, toggleCollapsed, mobileOpen, setMobileOpen } = useAdminShell();

  return (
    <header className="sticky top-0 z-30 flex h-admin-header shrink-0 items-center gap-3 border-b border-border bg-card px-4 md:px-6">
      <button
        type="button"
        className={`${iconButton} lg:hidden`}
        aria-label="Open menu"
        aria-controls={SIDEBAR_ID}
        aria-expanded={mobileOpen}
        onClick={() => setMobileOpen(true)}
      >
        <Menu aria-hidden className="size-5" />
      </button>
      <button
        type="button"
        className={`${iconButton} hidden lg:flex`}
        aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
        aria-controls={SIDEBAR_ID}
        aria-expanded={!collapsed}
        onClick={toggleCollapsed}
      >
        {collapsed ? <PanelLeftOpen aria-hidden className="size-5" /> : <PanelLeftClose aria-hidden className="size-5" />}
      </button>

      <Form action="/admin/orders" role="search" className="hidden flex-1 md:block md:max-w-md">
        <label htmlFor="admin-search" className="sr-only">
          Search orders
        </label>
        <div className="relative">
          <Search aria-hidden className="pointer-events-none absolute top-1/2 left-3.5 size-4 -translate-y-1/2 text-muted-foreground" />
          <input
            id="admin-search"
            name="q"
            type="search"
            maxLength={80}
            placeholder="Search orders by number, email or phone"
            className="min-h-touch w-full rounded-lg border border-border bg-secondary/60 pr-3.5 pl-10 text-sm text-foreground transition-colors outline-none placeholder:text-muted-foreground/80 focus-visible:border-primary/60 focus-visible:bg-card focus-visible:ring-3 focus-visible:ring-ring/40"
          />
        </div>
      </Form>

      <div className="ml-auto flex items-center gap-2">
        <Link href="/admin/orders" aria-label="Search orders" className={`${iconButton} md:hidden`}>
          <Search aria-hidden className="size-5" />
        </Link>
        <UserMenu email={email} role={role} />
      </div>
    </header>
  );
}

function UserMenu({ email, role }: { email: string | null; role: StaffRole }) {
  const [pending, startTransition] = useTransition();
  const name = email ?? "Admin";
  const initial = name.charAt(0).toUpperCase();
  const roleLabel = role === "owner" ? "Owner" : "Staff";

  return (
    <DropdownMenu>
      <DropdownMenuTrigger className="flex min-h-touch items-center gap-2.5 rounded-lg px-1.5 text-sm outline-none hover:bg-muted focus-visible:ring-3 focus-visible:ring-ring/60 data-[state=open]:bg-muted">
        <span
          aria-hidden
          className="flex size-10 shrink-0 items-center justify-center rounded-full bg-primary/10 font-heading text-lg text-primary"
        >
          {initial}
        </span>
        <span className="hidden max-w-48 flex-col items-start leading-tight sm:flex">
          <span className="w-full truncate font-medium">{name}</span>
          <span className="text-xs text-muted-foreground">{roleLabel}</span>
        </span>
        <span className="sr-only sm:hidden">Account menu for {name}</span>
        <ChevronDown aria-hidden className="size-4 text-muted-foreground" />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-64">
        <DropdownMenuLabel className="flex flex-col gap-0.5">
          <span className="truncate text-sm font-medium text-foreground">{name}</span>
          <span>{roleLabel} account</span>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem asChild>
          <Link href="/admin/settings">
            <Settings aria-hidden />
            Store settings
          </Link>
        </DropdownMenuItem>
        <DropdownMenuItem asChild>
          <Link href="/">
            <Store aria-hidden />
            View store
          </Link>
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem
          variant="destructive"
          disabled={pending}
          onSelect={(e) => {
            e.preventDefault();
            startTransition(() => adminSignOut());
          }}
        >
          <LogOut aria-hidden />
          {pending ? "Signing out…" : "Sign out"}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
