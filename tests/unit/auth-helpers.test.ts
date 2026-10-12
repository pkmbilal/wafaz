import { describe, expect, it } from "vitest";
import { INVALID_LOGIN, authErrorMessage } from "@/lib/auth/errors";
import { clientIp, hashIdentifier } from "@/lib/request";

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

  it("uses one message for an unknown email and a wrong password", () => {
    expect(authErrorMessage({ code: "invalid_credentials" })).toBe(INVALID_LOGIN);
  });

  it("explains password and confirmation problems", () => {
    expect(authErrorMessage({ code: "weak_password" })).toMatch(/stronger password/);
    expect(authErrorMessage({ code: "same_password" })).toMatch(/different/);
    expect(authErrorMessage({ code: "email_not_confirmed" })).toMatch(/Confirm your email/);
    expect(authErrorMessage({ code: "user_already_exists" })).toMatch(/Log in instead/);
  });
});
