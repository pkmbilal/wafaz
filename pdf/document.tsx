import path from "node:path";
import { Font, StyleSheet, Text, View } from "@react-pdf/renderer";
import { brandColors } from "@/lib/brand-colors";

// Shared building blocks for the PDFs (tax invoice now; credit note, packing slip and label in M8).
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
