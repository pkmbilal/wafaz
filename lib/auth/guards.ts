import "server-only";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export type StaffRole = "owner" | "staff";

export type AdminSession = { userId: string; role: StaffRole; email: string | null };

type Lookup = { status: "signed_out" } | { status: "not_admin" } | ({ status: "admin" } & AdminSession);

async function lookupAdmin(): Promise<Lookup> {
  const supabase = await createClient();
  const { data: claims } = await supabase.auth.getClaims();
  const userId = claims?.claims.sub;
  if (!userId || claims.claims.is_anonymous) return { status: "signed_out" };

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", userId)
    .single();

  if (profile?.role !== "owner" && profile?.role !== "staff") return { status: "not_admin" };
  const email = typeof claims.claims.email === "string" ? claims.claims.email : null;
  return { status: "admin", userId, role: profile.role, email };
}

// Route guard for admin pages. RLS enforces the same rule in the database.
export async function requireAdmin(): Promise<AdminSession> {
  const admin = await lookupAdmin();
  if (admin.status === "signed_out") redirect("/admin/login");
  if (admin.status === "not_admin") redirect("/");
  return { userId: admin.userId, role: admin.role, email: admin.email };
}

// For route handlers, which answer 401/403 instead of redirecting.
export async function getAdminSession(): Promise<AdminSession | null> {
  const admin = await lookupAdmin();
  return admin.status === "admin" ? { userId: admin.userId, role: admin.role, email: admin.email } : null;
}

// Owner-only Server Actions: redirects non-admins like requireAdmin, returns null for staff.
export async function requireOwner(): Promise<AdminSession | null> {
  const session = await requireAdmin();
  return session.role === "owner" ? session : null;
}
