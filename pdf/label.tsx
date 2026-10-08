import { Document, Page, Text, View, renderToBuffer } from "@react-pdf/renderer";
import { brandColors } from "@/lib/brand-colors";
import type { FulfilmentDoc } from "@/lib/orders/fulfilment-doc";
import { STORE_NAME } from "@/lib/site";
import { pdfStyles as s, registerPdfFonts } from "@/pdf/document";

// Shipping address label, 4 × 6 inch (the common thermal label size). Prepaid, so no COD amount.
// TODO(owner): confirm the label size used with your printer (4×6 in vs A6).

const LABEL_SIZE: [number, number] = [288, 432];

export function LabelDocument({ doc }: { doc: FulfilmentDoc }) {
  const a = doc.shipTo;
  return (
    <Document title={`Label ${doc.orderNumber}`} author={doc.seller.legalName} creator={STORE_NAME}>
      <Page size={LABEL_SIZE} style={[s.page, { padding: 14, fontSize: 9 }]}>
        <View style={[s.between, { borderBottomWidth: 2, borderBottomColor: brandColors.foreground, paddingBottom: 6 }]}>
          <Text style={{ fontSize: 14, lineHeight: 1.2, fontWeight: 700 }}>PREPAID</Text>
          <Text style={{ fontSize: 11, lineHeight: 1.2, fontWeight: 700 }}>{doc.orderNumber}</Text>
        </View>

        <View style={{ marginTop: 10 }}>
          <Text style={s.label}>Deliver to</Text>
          <Text style={{ fontSize: 14, lineHeight: 1.3, fontWeight: 700 }}>{a.name}</Text>
          <Text style={{ fontSize: 11, lineHeight: 1.35 }}>{a.line1}</Text>
          {a.line2 ? <Text style={{ fontSize: 11, lineHeight: 1.35 }}>{a.line2}</Text> : null}
          <Text style={{ fontSize: 11, lineHeight: 1.35 }}>
            {a.city}, {a.state_name}
          </Text>
          <Text style={{ fontSize: 16, lineHeight: 1.3, fontWeight: 700, letterSpacing: 2 }}>{a.pincode}</Text>
          <Text style={{ fontSize: 11, lineHeight: 1.35, marginTop: 2 }}>Phone: {a.phone}</Text>
        </View>

        <View style={[s.rule, { borderBottomColor: brandColors.foreground }]} />

        <View style={s.between}>
          <View>
            <Text style={s.label}>Weight</Text>
            <Text style={s.bold}>{`${doc.totalWeightGrams} g`}</Text>
          </View>
          {doc.shipment ? (
            <View style={{ alignItems: "flex-end" }}>
              <Text style={s.label}>{doc.shipment.courier}</Text>
              <Text style={s.bold}>{doc.shipment.trackingNumber}</Text>
            </View>
          ) : null}
        </View>

        <View style={[s.rule, { borderBottomColor: brandColors.foreground }]} />

        <View>
          <Text style={s.label}>Return to</Text>
          <Text style={s.bold}>{doc.seller.legalName}</Text>
          {doc.seller.addressLines.map((line) => (
            <Text key={line}>{line}</Text>
          ))}
          <Text>Phone: {doc.seller.phone}</Text>
        </View>
      </Page>
    </Document>
  );
}

export async function renderLabelPdf(doc: FulfilmentDoc): Promise<Buffer> {
  registerPdfFonts();
  return renderToBuffer(<LabelDocument doc={doc} />);
}
