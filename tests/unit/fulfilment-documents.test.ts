import { createElement } from "react";
import { render } from "@react-email/components";
import { beforeAll, describe, expect, it } from "vitest";
import { OrderCancelledEmail } from "@/emails/order-cancelled";
import { OrderShippedEmail } from "@/emails/order-shipped";
import type { CreditNoteRow } from "@/lib/orders/credit-note";
import type { FulfilmentDoc } from "@/lib/orders/fulfilment-doc";
import { courierLabels, isCourier, trackingUrl } from "@/lib/shipping/tracking";
import { orderFiltersSchema, refundOrderSchema, shipOrderSchema } from "@/lib/validators/admin-orders";
import { stubPublicEnv } from "../stubs/public-env";

// M8 documents (credit note, packing slip, label), tracking links, emails and admin validators.

let parseCreditNoteRow: typeof import("@/lib/orders/credit-note").parseCreditNoteRow;
let renderCreditNotePdf: typeof import("@/pdf/credit-note").renderCreditNotePdf;
let renderPackingSlipPdf: typeof import("@/pdf/packing-slip").renderPackingSlipPdf;
let renderLabelPdf: typeof import("@/pdf/label").renderLabelPdf;

beforeAll(async () => {
  stubPublicEnv();
  ({ parseCreditNoteRow } = await import("@/lib/orders/credit-note"));
  ({ renderCreditNotePdf } = await import("@/pdf/credit-note"));
  ({ renderPackingSlipPdf } = await import("@/pdf/packing-slip"));
  ({ renderLabelPdf } = await import("@/pdf/label"));
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

function creditNoteFixture(): CreditNoteRow {
  return parseCreditNoteRow({
    id: "4f6b1c56-6d0b-4c38-9f39-2f1f3f0b9a10",
    number: "CN/26-27/00001",
    issued_at: "2026-10-09T06:30:00Z",
    reason: "Customer changed their mind",
    totals: {
      items_paise: 100_000,
      shipping_paise: 0,
      total_paise: 100_000,
      taxable_total_paise: 95_238,
      cgst_paise: 2_381,
      sgst_paise: 2_381,
      igst_paise: 0,
    },
    lines: [
      {
        order_item_id: "a3a3d1a4-27f0-4f4d-8c33-5ad1d6b0b1a1",
        description: "Mirror Work Kurti (Maroon, M)",
        sku: "KUR-MAR-M",
        hsn_code: "6204",
        qty: 1,
        unit_price_paise: 105_000,
        discount_paise: 5_000,
        taxable_paise: 95_238,
        gst_rate_bps: 500,
        cgst_paise: 2_381,
        sgst_paise: 2_381,
        igst_paise: 0,
        total_paise: 100_000,
      },
    ],
    invoices: {
      number: "INV/26-27/00001",
      issued_at: "2026-10-08T06:30:00Z",
      place_of_supply_code: "32",
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
      buyer_snapshot: { email: "asha@example.com", phone: "+919876543210", billing_address: address, shipping_address: address },
    },
    orders: { number: "ORD-000123" },
  });
}

const fulfilmentDoc: FulfilmentDoc = {
  orderNumber: "ORD-000123",
  createdAt: "2026-10-08T06:30:00Z",
  totalWeightGrams: 650,
  shipTo: address,
  items: [{ title: "Mirror Work Kurti", colour: "Maroon", size: "M", sku: "KUR-MAR-M", qty: 2 }],
  shipment: { courier: "DTDC", trackingNumber: "D1234567" },
  seller: { tradeName: "Wafaz", legalName: "Wafaz Fashions LLP", addressLines: ["1 Market Road", "Kochi, Kerala 682001"], phone: "+910000000000" },
};

const isPdf = (pdf: Buffer) => pdf.subarray(0, 5).toString("latin1") === "%PDF-";

describe("PDFs", () => {
  it("renders a credit note", async () => {
    expect(isPdf(await renderCreditNotePdf(creditNoteFixture()))).toBe(true);
  }, 30_000);

  it("rejects a credit note snapshot with a missing field", () => {
    expect(() => parseCreditNoteRow({ ...creditNoteFixture(), totals: { total_paise: 1 } })).toThrow();
  });

  it("renders a packing slip and a label, with and without a shipment", async () => {
    expect(isPdf(await renderPackingSlipPdf(fulfilmentDoc))).toBe(true);
    expect(isPdf(await renderLabelPdf(fulfilmentDoc))).toBe(true);
    expect(isPdf(await renderLabelPdf({ ...fulfilmentDoc, shipment: null }))).toBe(true);
  }, 30_000);
});

describe("tracking links", () => {
  it("links DTDC by consignment number and India Post to its tracking page", () => {
    expect(trackingUrl("dtdc", " D12 34 ")).toContain(encodeURIComponent("D12 34"));
    expect(trackingUrl("india_post", "EE123456789IN")).toMatch(/^https:\/\/www\.indiapost\.gov\.in\//);
    expect(trackingUrl("other", "X1")).toBeNull();
  });

  it("recognises couriers", () => {
    expect(isCourier("dtdc")).toBe(true);
    expect(isCourier("fedex")).toBe(false);
    expect(courierLabels.india_post).toBe("India Post");
  });
});

describe("emails", () => {
  const seller = { legalName: "Wafaz Fashions LLP", addressLine: "Kochi", supportEmail: "s@x.in", supportPhone: "+91" };

  it("shipped email shows the tracking number and link", async () => {
    const html = await render(
      createElement(OrderShippedEmail, {
        orderNumber: "ORD-000123",
        customerName: "Asha Menon",
        courierName: "DTDC",
        trackingNumber: "D1234567",
        trackingUrl: "https://track.test/D1234567",
        orderUrl: "https://shop.test/orders/abc?t=tok",
        seller,
      }),
    );
    expect(html).toContain("D1234567");
    expect(html).toContain("https://track.test/D1234567");
  });

  it("cancelled email links the credit note when there is one", async () => {
    const props = {
      orderNumber: "ORD-000123",
      customerName: "Asha Menon",
      refundPaise: 100_000,
      orderUrl: "https://shop.test/orders/abc?t=tok",
      seller,
    };
    const withNote = await render(
      createElement(OrderCancelledEmail, {
        ...props,
        creditNoteNumber: "CN/26-27/00001",
        creditNoteUrl: "https://shop.test/api/credit-notes/x?t=tok",
      }),
    );
    expect(withNote).toContain("CN/26-27/00001");
    expect(withNote).toContain("https://shop.test/api/credit-notes/x?t=tok");
    const without = await render(createElement(OrderCancelledEmail, { ...props, creditNoteNumber: null, creditNoteUrl: null }));
    expect(without).not.toContain("Credit note");
  });
});

describe("admin validators", () => {
  it("normalises tracking numbers", () => {
    const parsed = shipOrderSchema.parse({
      orderId: "4f6b1c56-6d0b-4c38-9f39-2f1f3f0b9a10",
      courier: "dtdc",
      trackingNumber: " d12 345 ",
    });
    expect(parsed.trackingNumber).toBe("D12345");
    expect(
      shipOrderSchema.safeParse({ orderId: "4f6b1c56-6d0b-4c38-9f39-2f1f3f0b9a10", courier: "dtdc", trackingNumber: "ab" })
        .success,
    ).toBe(false);
  });

  it("drops unsafe or unknown list filters instead of failing", () => {
    expect(orderFiltersSchema.parse({ q: "a,b)", order: "nope", page: "2", attention: "1" })).toEqual({
      q: undefined,
      order: undefined,
      payment: undefined,
      fulfillment: undefined,
      attention: "1",
      page: 2,
    });
  });

  it("requires a reason for every refund", () => {
    expect(
      refundOrderSchema.safeParse({ kind: "cancel", orderId: "4f6b1c56-6d0b-4c38-9f39-2f1f3f0b9a10", reason: " " }).success,
    ).toBe(false);
  });
});
