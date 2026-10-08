import { Document, Page, Text, View, renderToBuffer } from "@react-pdf/renderer";
import { amountInWords, formatInrExact } from "@/lib/format";
import type { CreditNoteRow } from "@/lib/orders/credit-note";
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

// Credit note (CGST Act s.34) against the original tax invoice, rendered from the frozen row. Every
// figure was fixed when the refund was accepted; nothing is recalculated here.

export function CreditNoteDocument({ note }: { note: CreditNoteRow }) {
  const invoice = note.invoices;
  const seller = invoice.seller_snapshot;
  const buyer = invoice.buyer_snapshot;
  const totals = note.totals;
  const intraState = invoice.place_of_supply_code === seller.state_code;
  const placeOfSupply = `${buyer.shipping_address.state_name} (${invoice.place_of_supply_code})`;

  return (
    <Document title={`Credit note ${note.number}`} author={seller.legal_name} creator={STORE_NAME}>
      <Page size="A4" style={s.page}>
        <SellerHeader seller={seller} title="Credit note" subtitle="Original for recipient" />

        <View style={s.rule} />

        <View style={[s.row, { gap: 16 }]}>
          <View style={{ flex: 1 }}>
            <Field label="Credit note no.">{note.number}</Field>
            <Field label="Credit note date">{istDate.format(new Date(note.issued_at))}</Field>
          </View>
          <View style={{ flex: 1 }}>
            <Field label="Against invoice">{invoice.number}</Field>
            <Field label="Invoice date">{istDate.format(new Date(invoice.issued_at))}</Field>
          </View>
          <View style={{ flex: 1 }}>
            <Field label="Order no.">{note.orders.number}</Field>
            <Field label="Place of supply">{placeOfSupply}</Field>
          </View>
        </View>

        <View style={[s.row, { gap: 16, marginTop: 8 }]}>
          <AddressBlock heading="Issued to" lines={[...partyAddressLines(buyer.billing_address), buyer.email]} />
          <View style={{ flex: 1 }}>
            <Text style={[s.label, { marginBottom: 2 }]}>Reason</Text>
            <Text>{note.reason}</Text>
          </View>
        </View>

        <LineTable lines={note.lines} totals={totals} intraState={intraState} />

        <View style={[s.between, { marginTop: 14, gap: 24 }]} wrap={false}>
          <View style={{ flex: 1 }}>
            <Text style={s.label}>Amount in words</Text>
            <Text style={s.bold}>{amountInWords(totals.total_paise)}</Text>
            <Text style={[s.muted, { marginTop: 6 }]}>
              Refunded to the original payment method. Amounts are inclusive of GST; tax shown is the GST
              included in the refund.
            </Text>
          </View>
          <View style={[s.box, { width: 190 }]}>
            <SummaryRow label="Items (incl. GST)" value={formatInrExact(totals.items_paise)} />
            {totals.shipping_paise ? (
              <SummaryRow label="Shipping" value={formatInrExact(totals.shipping_paise)} />
            ) : null}
            {intraState ? (
              <>
                <SummaryRow label="CGST included" value={formatInrExact(totals.cgst_paise)} />
                <SummaryRow label="SGST included" value={formatInrExact(totals.sgst_paise)} />
              </>
            ) : (
              <SummaryRow label="IGST included" value={formatInrExact(totals.igst_paise)} />
            )}
            <View style={[s.rule, { marginVertical: 4 }]} />
            <SummaryRow label="Total credited" value={formatInrExact(totals.total_paise)} bold />
          </View>
        </View>

        <SignatureFooter
          legalName={seller.legal_name}
          note="This is a computer-generated credit note and does not need a physical signature."
        />
      </Page>
    </Document>
  );
}

export async function renderCreditNotePdf(note: CreditNoteRow): Promise<Buffer> {
  registerPdfFonts();
  return renderToBuffer(<CreditNoteDocument note={note} />);
}
