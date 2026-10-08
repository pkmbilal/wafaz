import { Link } from "@react-email/components";
import { formatInr } from "@/lib/format";
import { EmailLayout, type EmailSeller, PrimaryButton, greeting, muted, text } from "@/emails/components";

export type OrderRefundedEmailProps = {
  orderNumber: string;
  customerName: string | null;
  amountPaise: number;
  creditNoteNumber: string;
  creditNoteUrl: string;
  orderUrl: string;
  seller: EmailSeller;
};

// Wired up in M8, when admin issues a full or partial refund (each refund has a credit note).
export function OrderRefundedEmail(p: OrderRefundedEmailProps) {
  return (
    <EmailLayout preview={`Refund for order ${p.orderNumber}`} heading="Your refund is on its way" seller={p.seller}>
      <p style={text}>{greeting(p.customerName)}</p>
      <p style={text}>
        We&apos;ve refunded <strong>{formatInr(p.amountPaise)}</strong> for order <strong>{p.orderNumber}</strong> to
        your original payment method. Banks usually take 5–7 working days to show it.
      </p>
      <p style={text}>
        Credit note {p.creditNoteNumber}: <Link href={p.creditNoteUrl}>download (PDF)</Link>.
      </p>
      <PrimaryButton href={p.orderUrl}>View your order</PrimaryButton>
      <p style={muted}>Keep the credit note with your invoice for your records.</p>
    </EmailLayout>
  );
}
