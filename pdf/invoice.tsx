import { Document, Page, Text, View, renderToBuffer } from "@react-pdf/renderer";
import { amountInWords, formatInrExact } from "@/lib/format";
import type { InvoiceRow } from "@/lib/orders/invoice";
import { STORE_NAME } from "@/lib/site";
import {
  AddressBlock,
  Field,
  LineTable,
  SellerHeader,
  SignatureFooter,
  SummaryRow,
  istDate,
  partyAddressLines,
  pdfStyles as s,
  registerPdfFonts,
} from "@/pdf/document";

// Tax invoice (CGST Rules, rule 46) rendered from the frozen invoice row. No maths here beyond
// summing the stored line figures for the table footer; every amount comes from the snapshot.

export function InvoiceDocument({ invoice }: { invoice: InvoiceRow }) {
  const seller = invoice.seller_snapshot;
  const buyer = invoice.buyer_snapshot;
  const totals = invoice.totals;
  const intraState = invoice.place_of_supply_code === seller.state_code;
  const placeOfSupply = `${buyer.shipping_address.state_name} (${invoice.place_of_supply_code})`;

  return (
    <Document title={`Tax invoice ${invoice.number}`} author={seller.legal_name} creator={STORE_NAME}>
      <Page size="A4" style={s.page}>
        <SellerHeader seller={seller} title="Tax invoice" subtitle="Original for recipient" />

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
          <AddressBlock heading="Billed to" lines={[...partyAddressLines(buyer.billing_address), buyer.email]} />
          <AddressBlock heading="Shipped to" lines={partyAddressLines(buyer.shipping_address)} />
        </View>

        <LineTable lines={invoice.lines} totals={totals} intraState={intraState} />

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

        <SignatureFooter
          legalName={seller.legal_name}
          note="This is a computer-generated invoice and does not need a physical signature."
        />
      </Page>
    </Document>
  );
}

export async function renderInvoicePdf(invoice: InvoiceRow): Promise<Buffer> {
  registerPdfFonts();
  return renderToBuffer(<InvoiceDocument invoice={invoice} />);
}
