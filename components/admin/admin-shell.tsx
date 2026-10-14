"use client";

import { createContext, useCallback, useContext, useMemo, useState } from "react";
import { SIDEBAR_COOKIE } from "@/lib/admin/shell";

// Shared state for the admin chrome: the desktop sidebar can collapse to icons, and on phones it
// opens as a drawer. The collapsed choice lives in a cookie so the server renders it without a flash.

type ShellState = {
  collapsed: boolean;
  toggleCollapsed: () => void;
  mobileOpen: boolean;
  setMobileOpen: (open: boolean) => void;
};

const ShellContext = createContext<ShellState | null>(null);

export function useAdminShell(): ShellState {
  const ctx = useContext(ShellContext);
  if (!ctx) throw new Error("useAdminShell must be used inside <AdminShell>");
  return ctx;
}

export function AdminShell({ defaultCollapsed, children }: { defaultCollapsed: boolean; children: React.ReactNode }) {
  const [collapsed, setCollapsed] = useState(defaultCollapsed);
  const [mobileOpen, setMobileOpen] = useState(false);

  const toggleCollapsed = useCallback(() => {
    const next = !collapsed;
    setCollapsed(next);
    document.cookie = `${SIDEBAR_COOKIE}=${next ? "collapsed" : "expanded"}; path=/admin; max-age=31536000; samesite=lax`;
  }, [collapsed]);

  const value = useMemo(
    () => ({ collapsed, toggleCollapsed, mobileOpen, setMobileOpen }),
    [collapsed, toggleCollapsed, mobileOpen],
  );

  return (
    <ShellContext value={value}>
      <div data-collapsed={collapsed} className="group/shell flex min-h-dvh flex-1 bg-secondary">
        {children}
      </div>
    </ShellContext>
  );
}
