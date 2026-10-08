import {
  Body,
  Button,
  Container,
  Head,
  Heading,
  Hr,
  Html,
  Preview,
  Section,
  Text,
} from "@react-email/components";
import { brandColors as c } from "@/lib/brand-colors";
import { STORE_NAME } from "@/lib/site";

// Shared email chrome. Email clients ignore CSS variables and web fonts, so colours come from
// lib/brand-colors.ts and fonts fall back to web-safe stacks that echo the display serif / body sans.

export type EmailSeller = {
  legalName: string;
  addressLine: string;
  supportEmail: string;
  supportPhone: string;
};

const serif = "Georgia, 'Times New Roman', serif";
const sans = "-apple-system, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif";

export const text = { fontFamily: sans, fontSize: "15px", lineHeight: "22px", color: c.foreground, margin: "0 0 12px" };
export const muted = { ...text, fontSize: "13px", lineHeight: "20px", color: c.mutedForeground };

export function EmailLayout({
  preview,
  heading,
  seller,
  children,
}: {
  preview: string;
  heading: string;
  seller?: EmailSeller;
  children: React.ReactNode;
}) {
  return (
    <Html lang="en">
      <Head />
      <Preview>{preview}</Preview>
      <Body style={{ backgroundColor: c.background, margin: 0, padding: "24px 0" }}>
        <Container
          style={{
            backgroundColor: c.card,
            border: `1px solid ${c.border}`,
            borderRadius: "6px",
            maxWidth: "560px",
            padding: "28px 24px",
          }}
        >
          <Text style={{ fontFamily: serif, fontSize: "26px", color: c.primary, margin: "0 0 20px", fontWeight: 600 }}>
            {STORE_NAME}
          </Text>
          <Heading as="h1" style={{ fontFamily: serif, fontSize: "24px", color: c.foreground, margin: "0 0 16px" }}>
            {heading}
          </Heading>
          {children}
          {seller && (
            <>
              <Hr style={{ borderColor: c.border, margin: "28px 0 16px" }} />
              <Text style={{ ...muted, fontSize: "12px", lineHeight: "18px" }}>
                {seller.legalName}
                <br />
                {seller.addressLine}
                <br />
                Questions? Reply to this email, write to {seller.supportEmail} or call {seller.supportPhone}.
              </Text>
            </>
          )}
        </Container>
      </Body>
    </Html>
  );
}

export function PrimaryButton({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <Section style={{ margin: "8px 0 20px" }}>
      <Button
        href={href}
        style={{
          backgroundColor: c.primary,
          color: c.primaryForeground,
          fontFamily: sans,
          fontSize: "15px",
          fontWeight: 600,
          borderRadius: "6px",
          padding: "12px 20px",
          textDecoration: "none",
        }}
      >
        {children}
      </Button>
    </Section>
  );
}

// Two-column label/value row that survives clients without flexbox. The class lets the plain-text
// version lay it out as columns (see plainTextOptions).
export function AmountRow({ label, value, strong }: { label: string; value: string; strong?: boolean }) {
  const style = { ...text, margin: "0 0 4px", fontWeight: strong ? 700 : 400 };
  return (
    <table className="amount-row" width="100%" cellPadding={0} cellSpacing={0} role="presentation">
      <tbody>
        <tr>
          <td style={style}>{label}</td>
          <td style={{ ...style, textAlign: "right" }}>{value}</td>
        </tr>
      </tbody>
    </table>
  );
}

export const greeting = (name: string | null | undefined) => (name ? `Hi ${name.split(" ")[0]},` : "Hi,");

// Plain-text rendering: keep label/value rows apart ("Items   ₹2,599", not "Items₹2,599").
export const plainTextOptions = {
  selectors: [{ selector: "table.amount-row", format: "dataTable", options: { colSpacing: 3 } }],
};
