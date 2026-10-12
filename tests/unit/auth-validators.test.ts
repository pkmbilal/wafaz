import { describe, expect, it } from "vitest";
import {
  addressSchema,
  emailSchema,
  loginSchema,
  newPasswordSchema,
  normalizeIndianMobile,
  passwordSchema,
  profilePhoneSchema,
  safeNextPath,
  signupSchema,
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

describe("passwordSchema", () => {
  it("needs 8 to 72 characters", () => {
    expect(passwordSchema.safeParse("1234567").success).toBe(false);
    expect(passwordSchema.safeParse("12345678").success).toBe(true);
    expect(passwordSchema.safeParse("a".repeat(72)).success).toBe(true);
    expect(passwordSchema.safeParse("a".repeat(73)).success).toBe(false);
  });
});

describe("signupSchema", () => {
  const valid = {
    fullName: " Asha Nair ",
    email: "Asha@Example.com",
    password: "kurti-2026",
    confirmPassword: "kurti-2026",
  };

  it("normalises name and email", () => {
    const parsed = signupSchema.parse(valid);
    expect(parsed.fullName).toBe("Asha Nair");
    expect(parsed.email).toBe("asha@example.com");
  });

  it("rejects mismatched passwords on the confirm field", () => {
    const result = signupSchema.safeParse({ ...valid, confirmPassword: "kurti-2027" });
    expect(result.success).toBe(false);
    expect(result.error?.issues[0]?.path).toEqual(["confirmPassword"]);
  });

  it("requires a name", () => {
    expect(signupSchema.safeParse({ ...valid, fullName: "  " }).success).toBe(false);
  });
});

describe("newPasswordSchema", () => {
  it("checks length and match", () => {
    expect(newPasswordSchema.safeParse({ password: "short", confirmPassword: "short" }).success).toBe(false);
    expect(newPasswordSchema.safeParse({ password: "long-enough", confirmPassword: "different" }).success).toBe(false);
    expect(newPasswordSchema.safeParse({ password: "long-enough", confirmPassword: "long-enough" }).success).toBe(true);
  });
});

describe("loginSchema", () => {
  it("requires a password", () => {
    expect(loginSchema.safeParse({ email: "a@b.co", password: "" }).success).toBe(false);
    expect(loginSchema.safeParse({ email: "a@b.co", password: "x" }).success).toBe(true);
  });
});

describe("profilePhoneSchema", () => {
  it("normalises a number and clears on empty", () => {
    expect(profilePhoneSchema.parse({ phone: "98765 43210" }).phone).toBe("+919876543210");
    expect(profilePhoneSchema.parse({ phone: "" }).phone).toBeNull();
    expect(profilePhoneSchema.safeParse({ phone: "12345" }).success).toBe(false);
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
    "/signup",
    "/forgot-password?next=/cart",
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
