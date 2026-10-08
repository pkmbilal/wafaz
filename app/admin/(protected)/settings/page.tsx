import type { Metadata } from "next";
import { SettingsForm } from "@/components/admin/settings-form";
import { getAdminSettings } from "@/lib/admin/queries";
import { requireAdmin } from "@/lib/auth/guards";
import { getIndianStates } from "@/lib/catalog/queries";

export const metadata: Metadata = { title: "Settings" };

export default async function SettingsPage() {
  const [{ role }, settings, states] = await Promise.all([requireAdmin(), getAdminSettings(), getIndianStates()]);
  const canEdit = role === "owner";

  return (
    <main className="flex flex-col gap-6">
      <div className="flex flex-col gap-1">
        <h1 className="text-3xl font-semibold">Settings</h1>
        {!canEdit && <p className="text-sm text-muted-foreground">Only the owner can change these settings.</p>}
      </div>
      <SettingsForm defaultValues={settings} states={states} canEdit={canEdit} />
    </main>
  );
}
