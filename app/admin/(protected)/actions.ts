"use server";

import { refresh } from "next/cache";
import type { ActionResult } from "@/lib/admin-actions";
import { requireOwner } from "@/lib/auth/guards";
import { createAdminClient } from "@/lib/supabase/admin";
import { idSchema } from "@/lib/validators/admin-catalog";

// Hundred years: Supabase's way of blocking a login for good.
const BAN_FOREVER = "876000h";

// Processes a customer's account deletion request (owner only). The profile's personal data,
// saved addresses and cart are wiped in the DB. A customer with no orders is then deleted outright;
// one with orders keeps the auth row (orders reference it) with its login anonymised and banned,
// while orders, invoices and credit notes keep their own frozen copies for tax records.
export async function processDeletion(userId: unknown): Promise<ActionResult> {
  if (!(await requireOwner())) return { ok: false, error: "Only the owner can process deletion requests." };
  const parsed = idSchema.safeParse(userId);
  if (!parsed.success) return { ok: false, error: "Customer not found" };
  const id = parsed.data;

  const admin = createAdminClient();
  const { data: orderCount, error } = await admin.rpc("process_account_deletion", { p_user_id: id });
  if (error) return { ok: false, error: "This request was already processed or withdrawn." };

  const { error: authError } =
    orderCount === 0
      ? await admin.auth.admin.deleteUser(id)
      : await admin.auth.admin.updateUserById(id, {
          email: `deleted-${id}@deleted.invalid`,
          email_confirm: true,
          phone: "",
          user_metadata: {},
          ban_duration: BAN_FOREVER,
        });
  if (authError) {
    // The profile is already wiped; the login step can be retried from the Supabase dashboard.
    console.error("[account-deletion] auth update failed", authError.message);
    refresh();
    return { ok: false, error: "Personal data was removed, but the login couldn't be closed. Block the user in Supabase Auth." };
  }

  refresh();
  return { ok: true, message: orderCount === 0 ? "Account deleted" : "Account anonymised; orders kept for tax records" };
}
