import path from "node:path";
import { Font, StyleSheet, Text, View } from "@react-pdf/renderer";
import { brandColors } from "@/lib/brand-colors";
import { formatInrExact } from "@/lib/format";
import type { InvoiceAddress, InvoiceLine, SellerSnapshot } from "@/lib/orders/invoice";

// Shared building blocks for the PDFs: tax invoice, credit note, packing slip and shipping label.
// Noto Sans is bundled because the built-in Helvetica has no ₹ glyph. Fonts are traced into the
// serverless bundle via outputFileTracingIncludes in next.config.ts.

let registered = false;

export function registerPdfFonts() {
  if (registered) return;
  const dir = path.join(process.cwd(), "pdf", "fonts");
  Font.register({
    family: "Noto Sans",
    fonts: [
      { src: path.join(dir, "NotoSans-Regular.ttf"), fontWeight: 400 },
      { src: path.join(dir, "NotoSans-Bold.ttf"), fontWeight: 700 },
    ],
  });
  // Keep long words (SKUs, emails) on one line instead of hyphenating them.
  Font.registerHyphenationCallback((word) => [word]);
  registered = true;
}

export const pdfStyles = StyleSheet.create({
  page: {
    fontFamily: "Noto Sans",
    fontSize: 8,
    color: brandColors.foreground,
    paddingVertical: 32,
    paddingHorizontal: 32,
    lineHeight: 1.4,
  },
  row: { flexDirection: "row" },
  between: { flexDirection: "row", justifyContent: "space-between" },
  // Large text needs its own line height: the page's 1.4 is resolved at 8pt and would overlap.
  brand: { fontSize: 18, lineHeight: 1.2, marginBottom: 4, fontWeight: 700, color: brandColors.primary },
  title: { fontSize: 12, lineHeight: 1.2, marginBottom: 2, fontWeight: 700, letterSpacing: 1, textTransform: "uppercase" },
  label: { fontSize: 7, color: brandColors.mutedForeground, textTransform: "uppercase", letterSpacing: 0.5 },
  bold: { fontWeight: 700 },
  muted: { color: brandColors.mutedForeground },
  rule: { borderBottomWidth: 1, borderBottomColor: brandColors.border, marginVertical: 10 },
  box: { borderWidth: 1, borderColor: brandColors.border, borderRadius: 3, padding: 8 },
  tableHeader: {
    flexDirection: "row",
    backgroundColor: brandColors.secondary,
    borderBottomWidth: 1,
    borderBottomColor: brandColors.border,
    fontWeight: 700,
  },
  tableRow: { flexDirection: "row", borderBottomWidth: 1, borderBottomColor: brandColors.border },
  cell: { paddingVertical: 4, paddingHorizontal: 3 },
  num: { textAlign: "right" },
});

export function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <View style={{ marginBottom: 4 }}>
      <Text style={pdfStyles.label}>{label}</Text>
      <Text>{children}</Text>
    </View>
  );
}

export function AddressBlock({
  heading,
  lines,
}: {
  heading: string;
  lines: (string | null | undefined | false)[];
}) {
  return (
    <View style={{ flex: 1 }}>
      <Text style={[pdfStyles.label, { marginBottom: 2 }]}>{heading}</Text>
      {lines.filter(Boolean).map((line, i) => (
        <Text key={i} style={i === 0 ? pdfStyles.bold : undefined}>
          {line}
        </Text>
      ))}
    </View>
  );
}

export const istDate = new Intl.DateTimeFormat("en-IN", { dateStyle: "medium", timeZone: "Asia/Kolkata" });

// GST rate in basis points → "5%", "2.5%"; null (shipping rate not set) → "—".
export function formatRate(bps: number | null): string {
  if (bps === null) return "—";
  return `${(bps / 100).toString()}%`;
}

export function partyAddressLines(a: InvoiceAddress): string[] {
  return [
    a.name,
    a.line1,
    a.line2 ?? "",
    `${a.city}, ${a.state_name} ${a.pincode}`,
    `State code: ${a.state_code}`,
    `Phone: ${a.phone}`,
  ].filter(Boolean);
}

// Seller block (left) and document title (right), shared by the tax invoice and credit note.
export function SellerHeader({ seller, title, subtitle }: { seller: SellerSnapshot; title: string; subtitle: string }) {
  return (
    <View style={pdfStyles.between}>
      <View style={{ maxWidth: "60%" }}>
        <Text style={pdfStyles.brand}>{seller.trade_name}</Text>
        <Text style={pdfStyles.bold}>{seller.legal_name}</Text>
        <Text>{seller.address_line1}</Text>
        {seller.address_line2 ? <Text>{seller.address_line2}</Text> : null}
        <Text>
          {seller.city}, {seller.state ?? ""} {seller.pincode}
        </Text>
        <Text>
          {seller.email} · {seller.phone}
        </Text>
        {/* TODO(owner): GSTIN is empty until store_settings is filled in. */}
        <Text style={pdfStyles.bold}>GSTIN: {seller.gstin ?? "—"}</Text>
      </View>
      <View style={{ alignItems: "flex-end" }}>
        <Text style={pdfStyles.title}>{title}</Text>
        <Text style={pdfStyles.muted}>{subtitle}</Text>
      </View>
    </View>
  );
}

type Column = { key: string; label: string; width: number; numeric?: boolean };

export type LineTableTotals = {
  taxable_total_paise: number;
  cgst_paise: number;
  sgst_paise: number;
  igst_paise: number;
  total_paise: number;
};

// GST line table: CGST + SGST columns for intra-state supply, IGST otherwise. Prints the stored
// figures; the footer sums only the discount column, everything else comes from `totals`.
export function LineTable({
  lines,
  totals,
  intraState,
}: {
  lines: InvoiceLine[];
  totals: LineTableTotals;
  intraState: boolean;
}) {
  const s = pdfStyles;
  const columns: Column[] = [
    { key: "n", label: "#", width: 4 },
    { key: "desc", label: "Description", width: intraState ? 26 : 30 },
    { key: "hsn", label: "HSN/SAC", width: 8 },
    { key: "qty", label: "Qty", width: 5, numeric: true },
    { key: "rate", label: "Unit price", width: 9, numeric: true },
    { key: "disc", label: "Discount", width: 8, numeric: true },
    { key: "taxable", label: "Taxable", width: 9, numeric: true },
    { key: "gst", label: "GST", width: 5, numeric: true },
    ...(intraState
      ? [
          { key: "cgst", label: "CGST", width: 8, numeric: true },
          { key: "sgst", label: "SGST", width: 8, numeric: true },
        ]
      : [{ key: "igst", label: "IGST", width: 12, numeric: true }]),
    { key: "total", label: "Total", width: 10, numeric: true },
  ];

  const cellStyle = (c: Column) => [s.cell, { width: `${c.width}%` }, c.numeric ? s.num : {}];
  const discount = lines.reduce((acc, l) => acc + l.discount_paise, 0);

  return (
    <View style={{ marginTop: 14 }}>
      <View style={s.tableHeader} fixed>
        {columns.map((c) => (
          <Text key={c.key} style={cellStyle(c)}>
            {c.label}
          </Text>
        ))}
      </View>
      {lines.map((l, i) => {
        const values: Record<string, string> = {
          n: String(i + 1),
          desc: l.sku ? `${l.description}\nSKU: ${l.sku}` : l.description,
          hsn: l.hsn_code,
          qty: String(l.qty),
          rate: formatInrExact(l.unit_price_paise),
          disc: l.discount_paise ? formatInrExact(l.discount_paise) : "—",
          taxable: formatInrExact(l.taxable_paise),
          gst: formatRate(l.gst_rate_bps),
          cgst: formatInrExact(l.cgst_paise),
          sgst: formatInrExact(l.sgst_paise),
          igst: formatInrExact(l.igst_paise),
          total: formatInrExact(l.total_paise),
        };
        return (
          <View key={i} style={s.tableRow} wrap={false}>
            {columns.map((c) => (
              <Text key={c.key} style={cellStyle(c)}>
                {values[c.key]}
              </Text>
            ))}
          </View>
        );
      })}
      <View style={[s.tableRow, s.bold]} wrap={false}>
        {columns.map((c) => {
          const footer: Record<string, string> = {
            desc: "Total",
            disc: discount ? formatInrExact(discount) : "—",
            taxable: formatInrExact(totals.taxable_total_paise),
            cgst: formatInrExact(totals.cgst_paise),
            sgst: formatInrExact(totals.sgst_paise),
            igst: formatInrExact(totals.igst_paise),
            total: formatInrExact(totals.total_paise),
          };
          return (
            <Text key={c.key} style={cellStyle(c)}>
              {footer[c.key] ?? ""}
            </Text>
          );
        })}
      </View>
    </View>
  );
}

export function SummaryRow({ label, value, bold }: { label: string; value: string; bold?: boolean }) {
  return (
    <View style={[pdfStyles.between, { marginBottom: 2 }]}>
      <Text style={bold ? pdfStyles.bold : pdfStyles.muted}>{label}</Text>
      <Text style={bold ? pdfStyles.bold : undefined}>{value}</Text>
    </View>
  );
}

export function SignatureFooter({ legalName, note }: { legalName: string; note: string }) {
  return (
    <>
      <View style={{ marginTop: 28, alignItems: "flex-end" }} wrap={false}>
        <Text style={pdfStyles.bold}>For {legalName}</Text>
        <Text style={[pdfStyles.muted, { marginTop: 18 }]}>Authorised signatory</Text>
      </View>
      <View style={[pdfStyles.rule, { marginTop: 24 }]} />
      <Text style={[pdfStyles.muted, { textAlign: "center", fontSize: 7 }]}>{note}</Text>
    </>
  );
}
