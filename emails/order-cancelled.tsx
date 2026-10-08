import { formatInr } from "@/lib/format";
import { EmailLayout, type EmailSeller, PrimaryButton, greeting, muted, text } from "@/emails/components";

export type OrderCancelledEmailProps = {
  orderNumber: string;
  customerName: string | null;
  refundPaise: number;
  orderUrl: string;
  seller: EmailSeller;
};

// Wired up in M8, when admin cancels a paid order (always with a full refund).
export function OrderCancelledEmail(p: OrderCancelledEmailProps) {
  return (
    <EmailLayout
      preview={`Order ${p.orderNumber} has been cancelled`}
      heading="Your order has been cancelled"
      seller={p.seller}
    >
      <p style={text}>{greeting(p.customerName)}</p>
      <p style={text}>
        Order <strong>{p.orderNumber}</strong> has been cancelled. We&apos;ve started a full refund of{" "}
        <strong>{formatInr(p.refundPaise)}</strong> to your original payment method.
      </p>
      <p style={muted}>Banks usually take 5–7 working days to show the refund.</p>
      <PrimaryButton href={p.orderUrl}>View your order</PrimaryButton>
    </EmailLayout>
  );
}
