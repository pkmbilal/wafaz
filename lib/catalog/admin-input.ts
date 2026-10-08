import { compareSizes } from "@/lib/catalog/sizes";

// Pure helpers behind the admin catalog forms: rupee input ↔ paise, slugs, SKUs, the variant
// matrix generator and IST date inputs. Money stays in integer paise (AGENTS.md §5.1).

// "1,299.50" / "₹ 899" → integer paise, or null when the text isn't a valid amount.
export function rupeesToPaise(input: string): number | null {
  const clean = input.replace(/[₹,\s]/g, "");
  const match = /^(\d{1,8})(?:\.(\d{1,2}))?$/.exec(clean);
  if (!match) return null;
  const fraction = (match[2] ?? "").padEnd(2, "0");
  return Number(match[1]) * 100 + Number(fraction);
}

// Paise → the text an admin edits ("1299", "1299.5" → "1299.50").
export function paiseToRupeesInput(paise: number): string {
  const rupees = Math.floor(paise / 100);
  const rest = paise % 100;
  return rest === 0 ? String(rupees) : `${rupees}.${String(rest).padStart(2, "0")}`;
}

export const SLUG_PATTERN = /^[a-z0-9]+(-[a-z0-9]+)*$/;

export function slugify(text: string, maxLength = 80): string {
  return text
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, "-")
    .slice(0, maxLength)
    .replace(/^-+|-+$/g, "");
}

function skuPart(text: string, maxLength: number): string {
  return text.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, maxLength);
}

// Initials of the product slug: "indigo-block-print-kurti" → "IBPK".
export function skuPrefixFromSlug(slug: string): string {
  const initials = slug
    .split("-")
    .filter(Boolean)
    .map((w) => w[0])
    .join("");
  return skuPart(initials, 8) || "SKU";
}

// "IBPK" + "Off White" + "XL" → "IBPK-OFFWHI-XL" (fits the 40-char product_variants.sku pattern).
export function buildSku(prefix: string, colour: string, size: string): string {
  return [skuPart(prefix, 12), skuPart(colour, 8), skuPart(size, 10)].filter(Boolean).join("-");
}

export type MatrixColour = { name: string; hex: string };

export type MatrixInput = {
  skuPrefix: string;
  sizes: string[];
  colours: MatrixColour[];
  mrpPaise: number;
  pricePaise: number;
  weightGrams: number;
  stock: number;
};

export type MatrixRow = {
  sku: string;
  size: string;
  colour: string;
  colourHex: string;
  mrpPaise: number;
  pricePaise: number;
  weightGrams: number;
  stock: number;
};

const comboKey = (size: string, colour: string) => `${size.trim().toLowerCase()}|${colour.trim().toLowerCase()}`;

// Every size × colour combination not already in `existing`, grouped by colour, sizes in display order.
export function buildVariantMatrix(input: MatrixInput, existing: { size: string; colour: string }[] = []): MatrixRow[] {
  const taken = new Set(existing.map((v) => comboKey(v.size, v.colour)));
  const sizes = [...new Set(input.sizes.map((s) => s.trim()).filter(Boolean))].sort(compareSizes);
  const seenColours = new Set<string>();
  const rows: MatrixRow[] = [];

  for (const colour of input.colours) {
    const name = colour.name.trim();
    if (!name || seenColours.has(name.toLowerCase())) continue;
    seenColours.add(name.toLowerCase());
    for (const size of sizes) {
      const key = comboKey(size, name);
      if (taken.has(key)) continue;
      taken.add(key);
      rows.push({
        sku: buildSku(input.skuPrefix, name, size),
        size,
        colour: name,
        colourHex: colour.hex,
        mrpPaise: input.mrpPaise,
        pricePaise: input.pricePaise,
        weightGrams: input.weightGrams,
        stock: input.stock,
      });
    }
  }
  return rows;
}

// <input type="datetime-local"> values are Kerala time; the DB stores timestamptz.
const IST_OFFSET = "+05:30";

export function istLocalToIso(value: string): string | null {
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(value)) return null;
  const date = new Date(`${value}:00${IST_OFFSET}`);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

export function isoToIstLocal(iso: string | null): string {
  if (!iso) return "";
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Kolkata",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(new Date(iso));
  const get = (type: Intl.DateTimeFormatPartTypes) => parts.find((p) => p.type === type)?.value ?? "";
  return `${get("year")}-${get("month")}-${get("day")}T${get("hour")}:${get("minute")}`;
}

// "18" / "12.5" → basis points (1800 / 1250), or null when the text isn't a percent from 0 to 100.
export function percentToBps(input: string): number | null {
  const match = /^(\d{1,3})(?:\.(\d{1,2}))?$/.exec(input.trim());
  if (!match) return null;
  const bps = Number(match[1]) * 100 + Number((match[2] ?? "").padEnd(2, "0"));
  return bps <= 10000 ? bps : null;
}

export function bpsToPercentInput(bps: number): string {
  const whole = Math.floor(bps / 100);
  const rest = bps % 100;
  return rest === 0 ? String(whole) : `${whole}.${String(rest).padStart(2, "0").replace(/0$/, "")}`;
}
