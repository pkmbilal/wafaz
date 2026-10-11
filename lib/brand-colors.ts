// Hex copies of the colour tokens in app/globals.css, for PDFs and emails, which can't read CSS
// variables. Keep in sync with :root when the palette changes; the web UI must keep using the tokens.
export const brandColors = {
  background: "#ffffff", // --background
  foreground: "#1a1a1a", // --foreground (ink)
  primary: "#0f6b4f", // --primary (emerald)
  primaryForeground: "#ffffff", // --primary-foreground
  secondary: "#f6f4f0", // --secondary (warm grey)
  accent: "#b8945a", // --accent (muted gold)
  muted: "#f6f4f0", // --muted
  mutedForeground: "#6f6a64", // --muted-foreground
  border: "#e8e6e2", // --border
  card: "#ffffff", // --card
} as const;
