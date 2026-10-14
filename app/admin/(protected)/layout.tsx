import { cookies } from "next/headers";
import { AdminHeader } from "@/components/admin/admin-header";
import { AdminShell } from "@/components/admin/admin-shell";
import { AdminSidebar } from "@/components/admin/admin-sidebar";
import { Toaster } from "@/components/ui/sonner";
import { SIDEBAR_COOKIE } from "@/lib/admin/shell";
import { requireAdmin } from "@/lib/auth/guards";

// Admin is always dynamic: block on the server so unauthorised users get a real redirect
// instead of a streamed one.
export const instant = false;

export default async function ProtectedAdminLayout({ children }: { children: React.ReactNode }) {
  const [{ role, email }, cookieStore] = await Promise.all([requireAdmin(), cookies()]);
  const collapsed = cookieStore.get(SIDEBAR_COOKIE)?.value === "collapsed";

  return (
    <AdminShell defaultCollapsed={collapsed}>
      <AdminSidebar />
      <div className="flex min-w-0 flex-1 flex-col transition-[padding] duration-200 lg:pl-sidebar lg:group-data-[collapsed=true]/shell:pl-sidebar-collapsed">
        <AdminHeader email={email} role={role} />
        <div className="mx-auto flex w-full max-w-(--breakpoint-2xl) flex-1 flex-col p-4 md:p-6">{children}</div>
      </div>
      <Toaster />
    </AdminShell>
  );
}
