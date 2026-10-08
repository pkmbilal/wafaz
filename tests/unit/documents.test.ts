import { createElement } from "react";
import { render } from "@react-email/components";
import { beforeAll, describe, expect, it } from "vitest";
import { OrderConfirmedEmail } from "@/emails/order-confirmed";
import { amountInWords, formatInrExact } from "@/lib/format";
import type { InvoiceRow } from "@/lib/orders/invoice";
import { stubPublicEnv } from "../stubs/public-env";

let invoiceFileName: typeof import("@/lib/orders/invoice").invoiceFileName;
let parseInvoiceRow: typeof import("@/lib/orders/invoice").parseInvoiceRow;
let renderInvoicePdf: typeof import("@/pdf/invoice").renderInvoicePdf;

beforeAll(async () => {
  stubPublicEnv();
  ({ invoiceFileName, parseInvoiceRow } = await import("@/lib/orders/invoice"));
  ({ renderInvoicePdf } = await import("@/pdf/invoice"));
});

describe("amountInWords", () => {
  it.each([
    [0, "Rupees Zero Only"],
    [100, "Rupees One Only"],
    [1_150, "Rupees Eleven and Fifty Paise Only"],
    [99_999, "Rupees Nine Hundred Ninety Nine and Ninety Nine Paise Only"],
    [1_234_00, "Rupees One Thousand Two Hundred Thirty Four Only"],
    [1_05_000_00, "Rupees One Lakh Five Thousand Only"],
    [12_34_56_789_05, "Rupees Twelve Crore Thirty Four Lakh Fifty Six Thousand Seven Hundred Eighty Nine and Five Paise Only"],
  ])("%i paise → %s", (paise, words) => {
    expect(amountInWords(paise)).toBe(words);
  });

  it("rejects fractional or negative paise", () => {
    expect(() => amountInWords(1.5)).toThrow();
    expect(() => amountInWords(-1)).toThrow();
  });
});

describe("formatInrExact", () => {
  it("always shows two decimals", () => {
    expect(formatInrExact(125_000)).toBe("₹1,250.00");
    expect(formatInrExact(5)).toBe("₹0.05");
  });
});

const address = {
  name: "Asha Menon",
  phone: "+919876543210",
  line1: "12 MG Road",
  line2: null,
  city: "Kochi",
  state_code: "32",
  state_name: "Kerala",
  pincode: "682001",
};

function invoiceFixture(placeOfSupply: "32" | "29"): InvoiceRow {
  const intra = placeOfSupply === "32";
  const tax = (amount: number) => (intra ? { cgst_paise: amount / 2, sgst_paise: amount / 2, igst_paise: 0 } : { cgst_paise: 0, sgst_paise: 0, igst_paise: amount });
  return parseInvoiceRow({
    number: "INV/26-27/00001",
    issued_at: "2026-10-08T06:30:00Z",
    place_of_supply_code: placeOfSupply,
    seller_snapshot: {
      legal_name: "Wafaz Fashions LLP",
      trade_name: "Wafaz",
      gstin: "32ABCDE1234F1Z5",
      address_line1: "1 Market Road",
      address_line2: null,
      city: "Kochi",
      state: "Kerala",
      state_code: "32",
      pincode: "682001",
      email: "support@example.com",
      phone: "+910000000000",
    },
    buyer_snapshot: {
      email: "asha@example.com",
      phone: "+919876543210",
      billing_address: { ...address, state_code: placeOfSupply, state_name: intra ? "Kerala" : "Karnataka" },
      shipping_address: { ...address, state_code: placeOfSupply, state_name: intra ? "Kerala" : "Karnataka" },
    },
    totals: {
      subtotal_paise: 210_000,
      discount_paise: 10_000,
      shipping_paise: 0,
      total_paise: 200_000,
      taxable_total_paise: 190_476,
      ...tax(9_524),
      coupon_code: "WELCOME",
    },
    lines: [
      {
        description: "Mirror Work Kurti (Maroon, M)",
        sku: "KUR-MAR-M",
        hsn_code: "6204",
        qty: 2,
        unit_price_paise: 105_000,
        discount_paise: 10_000,
        taxable_paise: 190_476,
        gst_rate_bps: 500,
        ...tax(9_524),
        total_paise: 200_000,
      },
    ],
    orders: { number: "WF-000123" },
  });
}

describe("invoice PDF", () => {
  it.each(["32", "29"] as const)("renders a valid PDF for place of supply %s", async (pos) => {
    const pdf = await renderInvoicePdf(invoiceFixture(pos));
    expect(pdf.subarray(0, 5).toString("latin1")).toBe("%PDF-");
    expect(pdf.length).toBeGreaterThan(2_000);
  }, 30_000); // The first render loads and subsets the fonts.

  it("rejects a snapshot with a missing field instead of rendering it", () => {
    expect(() => parseInvoiceRow({ ...invoiceFixture("32"), totals: { total_paise: 1 } })).toThrow();
  });

  it("builds a safe download name", () => {
    expect(invoiceFileName("INV/26-27/00001")).toBe("INV-26-27-00001.pdf");
  });
});

describe("order confirmed email", () => {
  it("renders the guest link, invoice link and GST note", async () => {
    const html = await render(
      createElement(OrderConfirmedEmail, {
        orderNumber: "WF-000123",
        customerName: "Asha Menon",
        items: [{ title: "Mirror Work Kurti", variant: "Maroon, M", qty: 2, totalPaise: 200_000 }],
        subtotalPaise: 210_000,
        discountPaise: 10_000,
        couponCode: "WELCOME",
        shippingPaise: 0,
        totalPaise: 200_000,
        gstPaise: 9_524,
        addressLines: ["Asha Menon", "12 MG Road", "Kochi, Kerala 682001"],
        orderUrl: "https://shop.test/orders/abc?t=tok",
        invoiceUrl: "https://shop.test/api/invoices/abc?t=tok",
        seller: { legalName: "Wafaz Fashions LLP", addressLine: "Kochi", supportEmail: "s@x.in", supportPhone: "+91" },
      }),
    );
    expect(html).toContain("https://shop.test/orders/abc?t=tok");
    expect(html).toContain("https://shop.test/api/invoices/abc?t=tok");
    expect(html).toContain("Hi Asha,");
    expect(html).toContain("Discount (WELCOME)");
    expect(html).toContain("GST");
  });
});
