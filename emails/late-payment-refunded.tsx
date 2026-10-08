import { formatInr } from "@/lib/format";
import { EmailLayout, type EmailSeller, greeting, muted, text } from "@/emails/components";

export type LatePaymentRefundedEmailProps = {
  orderNumber: string;
  customerName: string | null;
  amountPaise: number;
  seller: EmailSeller;
};

// Payment arrived after the 30-minute reservation lapsed and the stock had gone (AGENTS.md §5.4 step 5).
export function LatePaymentRefundedEmail(p: LatePaymentRefundedEmailProps) {
  return (
    <EmailLayout
      preview={`We've refunded your payment for order ${p.orderNumber}`}
      heading="We've refunded your payment"
      seller={p.seller}
    >
      <p style={text}>{greeting(p.customerName)}</p>
      <p style={text}>
        Your payment for order <strong>{p.orderNumber}</strong> reached us after the checkout window had closed, and by
        then the items you chose had sold out. We&apos;re sorry about that.
      </p>
      <p style={text}>
        We&apos;ve started a full refund of <strong>{formatInr(p.amountPaise)}</strong> to your original payment
        method. Banks usually take 5–7 working days to show it.
      </p>
      <p style={muted}>Nothing was shipped and you don&apos;t need to do anything.</p>
    </EmailLayout>
  );
}
