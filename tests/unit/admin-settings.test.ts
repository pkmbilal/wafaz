import { describe, expect, it } from "vitest";
import { bpsToPercentInput, percentToBps } from "@/lib/catalog/admin-input";
import { couponSchema, type CouponInput } from "@/lib/validators/admin-coupons";
import { settingsSchema, type SettingsInput } from "@/lib/validators/admin-settings";

describe("percent input", () => {
  it.each([
    ["18", 1800],
    ["12.5", 1250],
    ["0", 0],
    ["100", 10000],
    ["2.75", 275],
  ])("parses %s", (input, bps) => {
    expect(percentToBps(input)).toBe(bps);
  });

  it.each(["", "101", "-1", "12.345", "abc"])("rejects %j", (input) => {
    expect(percentToBps(input)).toBeNull();
  });

  it("round-trips basis points", () => {
    for (const bps of [0, 500, 1250, 1205, 1800, 10000]) {
      expect(percentToBps(bpsToPercentInput(bps))).toBe(bps);
    }
    expect(bpsToPercentInput(1250)).toBe("12.5");
  });
});

const settings: SettingsInput = {
  legalName: "Wafaz Fashions LLP",
  tradeName: "Wafaz",
  gstin: "32abcde1234f1z5",
  addressLine1: "12 MG Road",
  addressLine2: "",
  city: "Kochi",
  stateCode: "32",
  pincode: "682016",
  supportEmail: "Support@Wafaz.in",
  supportPhone: "98765 43210",
  grievanceOfficerName: "Asha Nair",
  grievanceOfficerEmail: "grievance@wafaz.in",
  grievanceOfficerPhone: "+914842123456",
  invoicePrefix: "inv",
  creditNotePrefix: "CN",
  taxSlabBasis: "inclusive",
  shippingTaxRate: "",
  lowStockThreshold: "3",
  newBadgeDays: "30",
};

describe("settingsSchema", () => {
  it("normalises the form", () => {
    expect(settingsSchema.parse(settings)).toMatchObject({
      gstin: "32ABCDE1234F1Z5",
      addressLine2: null,
      supportEmail: "support@wafaz.in",
      supportPhone: "+919876543210",
      grievanceOfficerPhone: "+914842123456",
      invoicePrefix: "INV",
      shippingTaxRate: null,
      lowStockThreshold: 3,
    });
    expect(settingsSchema.parse({ ...settings, shippingTaxRate: "5" }).shippingTaxRate).toBe(500);
    expect(settingsSchema.parse({ ...settings, gstin: "" }).gstin).toBeNull();
  });

  it("checks the GSTIN against the state", () => {
    expect(settingsSchema.safeParse({ ...settings, stateCode: "29" }).success).toBe(false);
    expect(settingsSchema.safeParse({ ...settings, gstin: "32ABCDE1234F1Y5" }).success).toBe(false);
  });

  it("rejects bad prefixes and numbers", () => {
    expect(settingsSchema.safeParse({ ...settings, invoicePrefix: "INVOICE" }).success).toBe(false);
    expect(settingsSchema.safeParse({ ...settings, creditNotePrefix: "INV" }).success).toBe(false);
    expect(settingsSchema.safeParse({ ...settings, invoicePrefix: "IN1" }).success).toBe(false);
    expect(settingsSchema.safeParse({ ...settings, shippingTaxRate: "120" }).success).toBe(false);
    expect(settingsSchema.safeParse({ ...settings, lowStockThreshold: "-1" }).success).toBe(false);
    expect(settingsSchema.safeParse({ ...settings, supportPhone: "12345" }).success).toBe(false);
  });
});

const coupon: CouponInput = {
  code: " onam-20 ",
  kind: "percent",
  value: "20",
  maxDiscount: "500",
  minCart: "1,499",
  maxUses: "",
  perUserLimit: "1",
  firstOrderOnly: false,
  startsAt: "2026-08-20T00:00",
  endsAt: "2026-09-10T23:59",
  isActive: true,
};

describe("couponSchema", () => {
  it("parses a percent coupon", () => {
    expect(couponSchema.parse(coupon)).toMatchObject({
      code: "ONAM-20",
      value: 20,
      maxDiscount: 50000,
      minCart: 149900,
      maxUses: null,
      perUserLimit: 1,
      startsAt: "2026-08-19T18:30:00.000Z",
    });
  });

  it("parses a flat coupon in rupees and drops the cap", () => {
    expect(couponSchema.parse({ ...coupon, kind: "flat", value: "250" })).toMatchObject({
      value: 25000,
      maxDiscount: null,
    });
  });

  it.each([
    ["percent over 100", { value: "120" }],
    ["fractional percent", { value: "12.5" }],
    ["zero flat", { kind: "flat" as const, value: "0" }],
    ["short code", { code: "AB" }],
    ["bad code", { code: "ONAM 20" }],
    ["zero uses", { maxUses: "0" }],
    ["end before start", { endsAt: "2026-08-01T00:00" }],
  ])("rejects %s", (_, patch) => {
    expect(couponSchema.safeParse({ ...coupon, ...patch }).success).toBe(false);
  });
});
