import { EmailLayout, type EmailSeller, PrimaryButton, greeting, muted, text } from "@/emails/components";

export type OrderDeliveredEmailProps = {
  orderNumber: string;
  customerName: string | null;
  orderUrl: string;
  seller: EmailSeller;
};

// Wired up in M8, when admin marks an order delivered.
export function OrderDeliveredEmail(p: OrderDeliveredEmailProps) {
  return (
    <EmailLayout preview={`Order ${p.orderNumber} has been delivered`} heading="Your order has arrived" seller={p.seller}>
      <p style={text}>{greeting(p.customerName)}</p>
      <p style={text}>
        Order <strong>{p.orderNumber}</strong> has been delivered. We hope you love it.
      </p>
      <PrimaryButton href={p.orderUrl}>View your order</PrimaryButton>
      <p style={muted}>If anything isn&apos;t right, just reply to this email and we&apos;ll help.</p>
    </EmailLayout>
  );
}
