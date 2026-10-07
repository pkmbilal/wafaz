import { requireAdmin } from "@/lib/auth/guards";

// Admin is always dynamic: block on the server so unauthorised users get a real redirect
// instead of a streamed one.
export const instant = false;

export default async function ProtectedAdminLayout({ children }: { children: React.ReactNode }) {
  await requireAdmin();
  return <>{children}</>;
}
