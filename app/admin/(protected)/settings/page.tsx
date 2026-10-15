import type { Metadata } from "next";
import { PageHeader } from "@/components/admin/page-parts";
import { SettingsForm } from "@/components/admin/settings-form";
import { getAdminSettings } from "@/lib/admin/queries";
import { requireAdmin } from "@/lib/auth/guards";
import { getIndianStates } from "@/lib/catalog/queries";

export const metadata: Metadata = { title: "Settings" };

export default async function SettingsPage() {
  const [{ role }, settings, states] = await Promise.all([requireAdmin(), getAdminSettings(), getIndianStates()]);
  const canEdit = role === "owner";

  return (
    <main className="flex flex-col gap-4 md:gap-6">
      <PageHeader
        title="Settings"
        meta={!canEdit ? <p>Only the owner can change these settings.</p> : undefined}
      />
      <SettingsForm defaultValues={settings} states={states} canEdit={canEdit} />
    </main>
  );
}
