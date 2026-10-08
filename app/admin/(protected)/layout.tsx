import { AdminNav } from "@/components/admin/admin-nav";
import { Toaster } from "@/components/ui/sonner";
import { requireAdmin } from "@/lib/auth/guards";

// Admin is always dynamic: block on the server so unauthorised users get a real redirect
// instead of a streamed one.
export const instant = false;

export default async function ProtectedAdminLayout({ children }: { children: React.ReactNode }) {
  await requireAdmin();
  return (
    <>
      <AdminNav />
      <div className="mx-auto flex w-full max-w-6xl flex-1 flex-col px-4 py-6 lg:py-8">{children}</div>
      <Toaster />
    </>
  );
}
