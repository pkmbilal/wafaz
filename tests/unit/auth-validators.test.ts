import { describe, expect, it } from "vitest";
import {
  addressSchema,
  emailSchema,
  normalizeIndianMobile,
  requestOtpSchema,
  safeNextPath,
} from "@/lib/validators/auth";

describe("normalizeIndianMobile", () => {
  it.each([
    ["9876543210", "+919876543210"],
    ["98765 43210", "+919876543210"],
    ["098765-43210", "+919876543210"],
    ["+91 98765 43210", "+919876543210"],
    ["919876543210", "+919876543210"],
    ["(+91) 6000000000", "+916000000000"],
  ])("accepts %s", (input, expected) => {
    expect(normalizeIndianMobile(input)).toBe(expected);
  });

  it.each(["5876543210", "987654321", "98765432101", "+15551234567", "+9198765432", "abc", ""])(
    "rejects %s",
    (input) => {
      expect(normalizeIndianMobile(input)).toBeNull();
    },
  );
});

describe("emailSchema", () => {
  it("trims and lowercases", () => {
    expect(emailSchema.parse("  Asha@Example.COM ")).toBe("asha@example.com");
  });

  it("rejects invalid addresses", () => {
    expect(emailSchema.safeParse("not-an-email").success).toBe(false);
  });
});

describe("requestOtpSchema", () => {
  it("normalises the phone for WhatsApp", () => {
    const parsed = requestOtpSchema.parse({
      channel: "whatsapp",
      identifier: "98765 43210",
      captchaToken: "t",
    });
    expect(parsed.identifier).toBe("+919876543210");
  });

  it("requires a captcha token", () => {
    expect(
      requestOtpSchema.safeParse({ channel: "email", identifier: "a@b.co", captchaToken: "" }).success,
    ).toBe(false);
  });
});

describe("safeNextPath", () => {
  it.each([
    ["/account/addresses", "/account/addresses"],
    ["/checkout?step=2", "/checkout?step=2"],
  ])("keeps same-origin path %s", (input, expected) => {
    expect(safeNextPath(input)).toBe(expected);
  });

  it.each([
    undefined,
    null,
    "",
    "https://evil.example",
    "//evil.example",
    "/\\evil.example",
    "account",
    "/login",
    "/login?next=/account",
    "/account\u0000",
  ])("falls back for %s", (input) => {
    expect(safeNextPath(input)).toBe("/account");
  });

  it("uses the given fallback", () => {
    expect(safeNextPath("//x", "/")).toBe("/");
  });
});

describe("addressSchema", () => {
  const valid = {
    name: " Asha Nair ",
    phone: "98765 43210",
    line1: "12 MG Road",
    line2: "",
    city: "Kochi",
    stateCode: "32",
    pincode: "682016",
  };

  it("normalises a valid address", () => {
    expect(addressSchema.parse(valid)).toEqual({
      name: "Asha Nair",
      phone: "+919876543210",
      line1: "12 MG Road",
      line2: null,
      city: "Kochi",
      stateCode: "32",
      pincode: "682016",
      isDefault: false,
    });
  });

  it.each([
    ["pincode", "012345"],
    ["pincode", "68201"],
    ["stateCode", "Kerala"],
    ["phone", "12345"],
    ["name", "   "],
  ])("rejects a bad %s", (field, value) => {
    expect(addressSchema.safeParse({ ...valid, [field]: value }).success).toBe(false);
  });
});
