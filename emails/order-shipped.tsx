import { Link } from "@react-email/components";
import { EmailLayout, type EmailSeller, PrimaryButton, greeting, muted, text } from "@/emails/components";

export type OrderShippedEmailProps = {
  orderNumber: string;
  customerName: string | null;
  courierName: string;
  trackingNumber: string;
  trackingUrl: string;
  orderUrl: string;
  seller: EmailSeller;
};

// Wired up in M8, when admin marks an order shipped.
export function OrderShippedEmail(p: OrderShippedEmailProps) {
  return (
    <EmailLayout preview={`Order ${p.orderNumber} is on its way`} heading="Your order is on its way" seller={p.seller}>
      <p style={text}>{greeting(p.customerName)}</p>
      <p style={text}>
        Good news: order <strong>{p.orderNumber}</strong> has been shipped with {p.courierName}.
      </p>
      <p style={text}>
        Tracking number: <strong>{p.trackingNumber}</strong>
      </p>
      <PrimaryButton href={p.trackingUrl}>Track your parcel</PrimaryButton>
      <p style={muted}>
        If the tracking page asks for it, paste the tracking number above. Updates can take a day to appear.{" "}
        <Link href={p.orderUrl}>View your order</Link>.
      </p>
    </EmailLayout>
  );
}
