import type { Metadata } from "next";
import {
  AccountDeletion,
  MarketingConsent,
  NameForm,
  PhoneForm,
  SignOutButton,
} from "@/components/store/account/profile-sections";
import { ChangePasswordForm, EmailRow } from "@/components/store/account/sign-in-sections";
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
        <PhoneForm phone={profile.phone} />
      </Section>

      <Section title="Sign-in details" description="You sign in with your email and password.">
        <EmailRow email={profile.email} />
        <ChangePasswordForm email={profile.email} />
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
        <h2 className="text-3xl">{title}</h2>
        {description && <p className="text-sm text-muted-foreground">{description}</p>}
      </div>
      {children}
    </section>
  );
}
