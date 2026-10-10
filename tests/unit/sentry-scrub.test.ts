import { describe, expect, it } from "vitest";
import { redact, scrubBreadcrumb, scrubEvent } from "@/lib/sentry-scrub";

describe("redact", () => {
  it("masks emails and Indian mobile numbers", () => {
    expect(redact("mail priya.k+1@example.co.in now")).toBe("mail [email] now");
    expect(redact("call +91 98765 43210 or 9876543210 or 09876543210")).toBe(
      "call [phone] or [phone] or [phone]",
    );
    expect(redact("+919876543210")).toBe("[phone]");
  });

  it("leaves order numbers, amounts and ids alone", () => {
    const text = "INV/26-27/00001 total 129900 paise, pincode 682001, id 1234567890123";
    expect(redact(text)).toBe(text);
  });
});

describe("scrubEvent", () => {
  it("keeps only the user id and drops request bodies, cookies, headers and query", () => {
    const event = scrubEvent({
      user: { id: "uid-1", email: "a@b.com", ip_address: "1.2.3.4" },
      request: {
        url: "https://shop.example/orders/abc?t=secret-token",
        data: { address: "12 MG Road" },
        cookies: { sb: "x" },
        headers: { cookie: "x" },
        query_string: "t=secret-token",
      },
    });
    expect(event.user).toEqual({ id: "uid-1" });
    expect(event.request).toEqual({ url: "https://shop.example/orders/abc" });
  });

  it("drops a user with no id", () => {
    expect(scrubEvent({ user: { email: "a@b.com" } }).user).toBeUndefined();
  });

  it("redacts messages, exception values, breadcrumbs and string extras", () => {
    const event = scrubEvent({
      message: "failed for a@b.com",
      exception: { values: [{ value: "phone 9876543210 invalid" }, {}] },
      breadcrumbs: [{ message: "sent to a@b.com", data: { phone: "9876543210" } }],
      extra: { note: "a@b.com", count: 3 },
    });
    expect(event.message).toBe("failed for [email]");
    expect(event.exception?.values).toEqual([{ value: "phone [phone] invalid" }, {}]);
    expect(event.breadcrumbs).toEqual([{ message: "sent to [email]" }]);
    expect(event.extra).toEqual({ note: "[email]", count: 3 });
  });

  it("drops breadcrumb data", () => {
    expect(scrubBreadcrumb({ data: { url: "/x" } })).toEqual({});
  });
});
