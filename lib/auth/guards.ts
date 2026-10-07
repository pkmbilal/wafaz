import "server-only";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export type StaffRole = "owner" | "staff";

// Route guard for admin pages. RLS enforces the same rule in the database.
export async function requireAdmin(): Promise<{ userId: string; role: StaffRole }> {
  const supabase = await createClient();
  const { data: claims } = await supabase.auth.getClaims();
  const userId = claims?.claims.sub;

  if (!userId || claims.claims.is_anonymous) {
    redirect("/login?next=/admin");
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", userId)
    .single();

  if (profile?.role !== "owner" && profile?.role !== "staff") {
    redirect("/");
  }

  return { userId, role: profile.role };
}
