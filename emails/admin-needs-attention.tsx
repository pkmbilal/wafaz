import { EmailLayout, PrimaryButton, muted, text } from "@/emails/components";

export type AdminNeedsAttentionEmailProps = {
  orderNumber: string;
  reason: string;
  adminUrl: string;
};

// Internal alert to the store owner when an order lands in "Needs attention".
export function AdminNeedsAttentionEmail(p: AdminNeedsAttentionEmailProps) {
  return (
    <EmailLayout preview={`Order ${p.orderNumber} needs attention`} heading={`Order ${p.orderNumber} needs attention`}>
      <p style={text}>{p.reason}</p>
      <PrimaryButton href={p.adminUrl}>Open admin</PrimaryButton>
      <p style={muted}>The order has been flagged and won&apos;t be fulfilled automatically until you review it.</p>
    </EmailLayout>
  );
}
