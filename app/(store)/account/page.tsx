import type { Metadata } from "next";
import {
  AccountDeletion,
  ContactRow,
  MarketingConsent,
  NameForm,
  SignOutButton,
} from "@/components/store/account/profile-sections";
import { Separator } from "@/components/ui/separator";
import { getAccountProfile } from "@/lib/account/queries";
import { requireUser } from "@/lib/auth/session";

export const metadata: Metadata = { title: "My profile" };

export default async function AccountProfilePage() {
  const { id } = await requireUser();
  const profile = await getAccountProfile(id);

  return (
    <div className="flex flex-col gap-10">
      <Section title="Profile">
        <NameForm fullName={profile.fullName} />
      </Section>

      <Section
        title="Sign-in details"
        description="Use either of these to sign in with a one-time code."
      >
        <div className="divide-y divide-border">
          <ContactRow channel="whatsapp" value={profile.phone} />
          <ContactRow channel="email" value={profile.email} />
        </div>
      </Section>

      <Section title="Communication">
        <MarketingConsent consent={profile.marketingConsent} />
      </Section>

      <Separator />

      <Section title="Delete account">
        <AccountDeletion requestedAt={profile.deletionRequestedAt} />
      </Section>

      <div>
        <SignOutButton />
      </div>
    </div>
  );
}

function Section({
  title,
  description,
  children,
}: {
  title: string;
  description?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="flex flex-col gap-4">
      <div className="flex flex-col gap-1">
        <h2 className="text-2xl font-semibold">{title}</h2>
        {description && <p className="text-sm text-muted-foreground">{description}</p>}
      </div>
      {children}
    </section>
  );
}
