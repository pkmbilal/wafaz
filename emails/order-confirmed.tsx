import { Link, Section } from "@react-email/components";
import { formatInr } from "@/lib/format";
import { AmountRow, EmailLayout, type EmailSeller, PrimaryButton, greeting, muted, text } from "@/emails/components";

export type OrderConfirmedEmailProps = {
  orderNumber: string;
  customerName: string | null;
  items: { title: string; variant: string; qty: number; totalPaise: number }[];
  subtotalPaise: number;
  discountPaise: number;
  couponCode: string | null;
  shippingPaise: number;
  totalPaise: number;
  gstPaise: number;
  addressLines: string[];
  orderUrl: string;
  invoiceUrl: string | null;
  seller: EmailSeller;
};

export function OrderConfirmedEmail(p: OrderConfirmedEmailProps) {
  return (
    <EmailLayout preview={`Order ${p.orderNumber} is confirmed`} heading="Your order is confirmed" seller={p.seller}>
      <p style={text}>{greeting(p.customerName)}</p>
      <p style={text}>
        Thank you for shopping with us. We&apos;ve received your payment for order <strong>{p.orderNumber}</strong> and
        we&apos;re getting it ready. We&apos;ll email you the tracking details as soon as it ships.
      </p>
      <PrimaryButton href={p.orderUrl}>View your order</PrimaryButton>

      <Section style={{ margin: "8px 0 16px" }}>
        {p.items.map((item, i) => (
          <AmountRow key={i} label={`${item.title} (${item.variant}) × ${item.qty}`} value={formatInr(item.totalPaise)} />
        ))}
      </Section>
      <Section style={{ margin: "0 0 16px" }}>
        <AmountRow label="Items" value={formatInr(p.subtotalPaise)} />
        {p.discountPaise > 0 && (
          <AmountRow
            label={p.couponCode ? `Discount (${p.couponCode})` : "Discount"}
            value={`− ${formatInr(p.discountPaise)}`}
          />
        )}
        <AmountRow label="Shipping" value={p.shippingPaise ? formatInr(p.shippingPaise) : "Free"} />
        <AmountRow label="Total paid" value={formatInr(p.totalPaise)} strong />
        <p style={muted}>Includes {formatInr(p.gstPaise)} GST.</p>
      </Section>

      <p style={{ ...text, fontWeight: 700, margin: "0 0 4px" }}>Delivering to</p>
      <p style={text}>
        {p.addressLines.map((line, i) => (
          <span key={i}>
            {line}
            <br />
          </span>
        ))}
      </p>

      {p.invoiceUrl && (
        <p style={muted}>
          Your tax invoice is ready: <Link href={p.invoiceUrl}>download the invoice (PDF)</Link>.
        </p>
      )}
      <p style={muted}>Keep this email: the order link above works without signing in.</p>
    </EmailLayout>
  );
}
