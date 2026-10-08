import { Document, Page, Text, View, renderToBuffer } from "@react-pdf/renderer";
import { brandColors } from "@/lib/brand-colors";
import type { FulfilmentDoc } from "@/lib/orders/fulfilment-doc";
import { STORE_NAME } from "@/lib/site";
import { AddressBlock, Field, istDate, pdfStyles as s, registerPdfFonts } from "@/pdf/document";

// Packing slip (A4): what goes in the parcel. No prices, so it can travel inside the box.

export function PackingSlipDocument({ doc }: { doc: FulfilmentDoc }) {
  const a = doc.shipTo;
  const units = doc.items.reduce((sum, i) => sum + i.qty, 0);
  const cell = (width: string, numeric = false) => [s.cell, { width }, numeric ? s.num : {}];

  return (
    <Document title={`Packing slip ${doc.orderNumber}`} author={doc.seller.legalName} creator={STORE_NAME}>
      <Page size="A4" style={s.page}>
        <View style={s.between}>
          <View>
            <Text style={s.brand}>{doc.seller.tradeName}</Text>
            {doc.seller.addressLines.map((line) => (
              <Text key={line}>{line}</Text>
            ))}
            <Text>{doc.seller.phone}</Text>
          </View>
          <View style={{ alignItems: "flex-end" }}>
            <Text style={s.title}>Packing slip</Text>
          </View>
        </View>

        <View style={s.rule} />

        <View style={[s.row, { gap: 16 }]}>
          <View style={{ flex: 1 }}>
            <Field label="Order no.">{doc.orderNumber}</Field>
            <Field label="Order date">{istDate.format(new Date(doc.createdAt))}</Field>
          </View>
          <View style={{ flex: 1 }}>
            <Field label="Items">{String(units)}</Field>
            <Field label="Weight">{`${doc.totalWeightGrams} g`}</Field>
          </View>
          <AddressBlock
            heading="Ship to"
            lines={[a.name, a.line1, a.line2, `${a.city}, ${a.state_name} ${a.pincode}`, a.phone]}
          />
        </View>

        <View style={{ marginTop: 14 }}>
          <View style={s.tableHeader} fixed>
            <Text style={cell("6%")}> </Text>
            <Text style={cell("46%")}>Item</Text>
            <Text style={cell("20%")}>Colour / size</Text>
            <Text style={cell("20%")}>SKU</Text>
            <Text style={cell("8%", true)}>Qty</Text>
          </View>
          {doc.items.map((item) => (
            <View key={item.sku} style={s.tableRow} wrap={false}>
              <View style={cell("6%")}>
                <View style={{ width: 8, height: 8, borderWidth: 1, borderColor: brandColors.foreground }} />
              </View>
              <Text style={cell("46%")}>{item.title}</Text>
              <Text style={cell("20%")}>
                {item.colour} / {item.size}
              </Text>
              <Text style={cell("20%")}>{item.sku}</Text>
              <Text style={[...cell("8%", true), s.bold]}>{String(item.qty)}</Text>
            </View>
          ))}
        </View>

        <Text style={[s.muted, { marginTop: 24, textAlign: "center" }]}>
          Thank you for shopping with {doc.seller.tradeName}.
        </Text>
      </Page>
    </Document>
  );
}

export async function renderPackingSlipPdf(doc: FulfilmentDoc): Promise<Buffer> {
  registerPdfFonts();
  return renderToBuffer(<PackingSlipDocument doc={doc} />);
}
