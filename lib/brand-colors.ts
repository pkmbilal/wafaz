// Hex copies of the colour tokens in app/globals.css, for PDFs and emails, which can't read CSS
// variables. Keep in sync with :root when the palette changes; the web UI must keep using the tokens.
export const brandColors = {
  background: "#fdfaf4", // --background
  foreground: "#281c1a", // --foreground
  primary: "#6b1d26", // --primary (deep maroon)
  primaryForeground: "#fdfaf4", // --primary-foreground
  secondary: "#f3eadd", // --secondary (sand)
  accent: "#cc9c42", // --accent (antique gold)
  muted: "#f4f0e9", // --muted
  mutedForeground: "#6e605b", // --muted-foreground
  border: "#e4ddd3", // --border
  card: "#ffffff", // --card
} as const;
