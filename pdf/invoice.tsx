import { Document, Page, Text, View, renderToBuffer } from "@react-pdf/renderer";
import { amountInWords, formatInrExact } from "@/lib/format";
import type { InvoiceAddress, InvoiceRow } from "@/lib/orders/invoice";
import { STORE_NAME } from "@/lib/site";
import { AddressBlock, Field, formatRate, istDate, pdfStyles as s, registerPdfFonts } from "@/pdf/document";

// Tax invoice (CGST Rules, rule 46) rendered from the frozen invoice row. No maths here beyond
// summing the stored line figures for the table footer; every amount comes from the snapshot.

function addressLines(a: InvoiceAddress): string[] {
  return [
    a.name,
    a.line1,
    a.line2 ?? "",
    `${a.city}, ${a.state_name} ${a.pincode}`,
    `State code: ${a.state_code}`,
    `Phone: ${a.phone}`,
  ].filter(Boolean);
}

type Column = { key: string; label: string; width: number; numeric?: boolean };

export function InvoiceDocument({ invoice }: { invoice: InvoiceRow }) {
  const seller = invoice.seller_snapshot;
  const buyer = invoice.buyer_snapshot;
  const totals = invoice.totals;
  const intraState = invoice.place_of_supply_code === seller.state_code;
  const placeOfSupply = `${buyer.shipping_address.state_name} (${invoice.place_of_supply_code})`;

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
  const sum = (pick: (l: InvoiceRow["lines"][number]) => number) =>
    invoice.lines.reduce((acc, l) => acc + pick(l), 0);

  return (
    <Document title={`Tax invoice ${invoice.number}`} author={seller.legal_name} creator={STORE_NAME}>
      <Page size="A4" style={s.page}>
        <View style={s.between}>
          <View style={{ maxWidth: "60%" }}>
            <Text style={s.brand}>{seller.trade_name}</Text>
            <Text style={s.bold}>{seller.legal_name}</Text>
            <Text>{seller.address_line1}</Text>
            {seller.address_line2 ? <Text>{seller.address_line2}</Text> : null}
            <Text>
              {seller.city}, {seller.state ?? ""} {seller.pincode}
            </Text>
            <Text>
              {seller.email} · {seller.phone}
            </Text>
            {/* TODO(owner): GSTIN is empty until store_settings is filled in. */}
            <Text style={s.bold}>GSTIN: {seller.gstin ?? "—"}</Text>
          </View>
          <View style={{ alignItems: "flex-end" }}>
            <Text style={s.title}>Tax invoice</Text>
            <Text style={s.muted}>Original for recipient</Text>
          </View>
        </View>

        <View style={s.rule} />

        <View style={[s.row, { gap: 16 }]}>
          <View style={{ flex: 1 }}>
            <Field label="Invoice no.">{invoice.number}</Field>
            <Field label="Invoice date">{istDate.format(new Date(invoice.issued_at))}</Field>
          </View>
          <View style={{ flex: 1 }}>
            <Field label="Order no.">{invoice.orders.number}</Field>
            <Field label="Payment">Prepaid online</Field>
          </View>
          <View style={{ flex: 1 }}>
            <Field label="Place of supply">{placeOfSupply}</Field>
            <Field label="Reverse charge">No</Field>
          </View>
        </View>

        <View style={[s.row, { gap: 16, marginTop: 8 }]}>
          <AddressBlock heading="Billed to" lines={[...addressLines(buyer.billing_address), buyer.email]} />
          <AddressBlock heading="Shipped to" lines={addressLines(buyer.shipping_address)} />
        </View>

        <View style={{ marginTop: 14 }}>
          <View style={s.tableHeader} fixed>
            {columns.map((c) => (
              <Text key={c.key} style={cellStyle(c)}>
                {c.label}
              </Text>
            ))}
          </View>
          {invoice.lines.map((l, i) => {
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
                disc: totals.discount_paise ? formatInrExact(sum((l) => l.discount_paise)) : "—",
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

        <View style={[s.between, { marginTop: 14, gap: 24 }]} wrap={false}>
          <View style={{ flex: 1 }}>
            <Text style={s.label}>Amount in words</Text>
            <Text style={s.bold}>{amountInWords(totals.total_paise)}</Text>
            <Text style={[s.muted, { marginTop: 6 }]}>
              All prices are inclusive of GST. Tax shown is the GST included in the price.
            </Text>
            {totals.coupon_code ? (
              <Text style={s.muted}>Coupon {totals.coupon_code} applied; discount allocated across items.</Text>
            ) : null}
          </View>
          <View style={[s.box, { width: 190 }]}>
            <SummaryRow label="Items (incl. GST)" value={formatInrExact(totals.subtotal_paise)} />
            {totals.discount_paise ? (
              <SummaryRow label="Discount" value={`− ${formatInrExact(totals.discount_paise)}`} />
            ) : null}
            <SummaryRow
              label="Shipping"
              value={totals.shipping_paise ? formatInrExact(totals.shipping_paise) : "Free"}
            />
            {intraState ? (
              <>
                <SummaryRow label="CGST included" value={formatInrExact(totals.cgst_paise)} />
                <SummaryRow label="SGST included" value={formatInrExact(totals.sgst_paise)} />
              </>
            ) : (
              <SummaryRow label="IGST included" value={formatInrExact(totals.igst_paise)} />
            )}
            <View style={[s.rule, { marginVertical: 4 }]} />
            <SummaryRow label="Total paid" value={formatInrExact(totals.total_paise)} bold />
          </View>
        </View>

        <View style={{ marginTop: 28, alignItems: "flex-end" }} wrap={false}>
          <Text style={s.bold}>For {seller.legal_name}</Text>
          <Text style={[s.muted, { marginTop: 18 }]}>Authorised signatory</Text>
        </View>

        <View style={[s.rule, { marginTop: 24 }]} />
        <Text style={[s.muted, { textAlign: "center", fontSize: 7 }]}>
          This is a computer-generated invoice and does not need a physical signature.
        </Text>
      </Page>
    </Document>
  );
}

function SummaryRow({ label, value, bold }: { label: string; value: string; bold?: boolean }) {
  return (
    <View style={[s.between, { marginBottom: 2 }]}>
      <Text style={bold ? s.bold : s.muted}>{label}</Text>
      <Text style={bold ? s.bold : undefined}>{value}</Text>
    </View>
  );
}

export async function renderInvoicePdf(invoice: InvoiceRow): Promise<Buffer> {
  registerPdfFonts();
  return renderToBuffer(<InvoiceDocument invoice={invoice} />);
}
