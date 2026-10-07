import { describe, expect, it } from "vitest";
import { authErrorMessage, isAlreadyLinked } from "@/lib/auth/errors";
import { clientIp, hashIdentifier } from "@/lib/request";
import { buildOtpTemplatePayload } from "@/lib/whatsapp-payload";

describe("clientIp", () => {
  const headers = (h: Record<string, string>) => new Headers(h);

  it("takes the left-most x-forwarded-for entry", () => {
    expect(clientIp(headers({ "x-forwarded-for": "203.0.113.7, 10.0.0.1" }))).toBe("203.0.113.7");
  });

  it("falls back to x-real-ip, then 'unknown'", () => {
    expect(clientIp(headers({ "x-real-ip": "198.51.100.2" }))).toBe("198.51.100.2");
    expect(clientIp(headers({}))).toBe("unknown");
  });
});

describe("hashIdentifier", () => {
  it("returns a sha256 hex digest without the raw value", () => {
    const hash = hashIdentifier("+919876543210");
    expect(hash).toMatch(/^[0-9a-f]{64}$/);
    expect(hash).not.toContain("9876543210");
    expect(hashIdentifier("+919876543210")).toBe(hash);
  });
});

describe("buildOtpTemplatePayload", () => {
  it("builds an authentication template with a copy-code button", () => {
    expect(
      buildOtpTemplatePayload({ toE164: "+919876543210", code: "123456", template: "otp", language: "en" }),
    ).toEqual({
      messaging_product: "whatsapp",
      recipient_type: "individual",
      to: "919876543210",
      type: "template",
      template: {
        name: "otp",
        language: { code: "en" },
        components: [
          { type: "body", parameters: [{ type: "text", text: "123456" }] },
          { type: "button", sub_type: "url", index: "0", parameters: [{ type: "text", text: "123456" }] },
        ],
      },
    });
  });
});

describe("authErrorMessage", () => {
  it("maps known codes to customer copy", () => {
    expect(authErrorMessage({ code: "otp_expired" })).toMatch(/wrong or has expired/);
    expect(authErrorMessage({ code: "captcha_failed" })).toMatch(/security check/);
  });

  it("treats 429 as a rate limit", () => {
    expect(authErrorMessage({ status: 429 })).toMatch(/Too many attempts/);
  });

  it("never echoes unknown internal messages", () => {
    expect(authErrorMessage({ code: "weird", message: "db exploded at line 3" })).toBe(
      "Something went wrong. Please try again.",
    );
  });

  it("detects contacts that already belong to another account", () => {
    expect(isAlreadyLinked({ code: "phone_exists" })).toBe(true);
    expect(isAlreadyLinked({ code: "email_exists" })).toBe(true);
    expect(isAlreadyLinked({ code: "otp_expired" })).toBe(false);
  });
});
