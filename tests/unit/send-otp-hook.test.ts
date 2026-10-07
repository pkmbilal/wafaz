import { randomBytes, randomUUID } from "node:crypto";
import { Webhook } from "standardwebhooks";
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

const secretB64 = randomBytes(32).toString("base64");

const rateLimit = vi.fn<(...args: unknown[]) => Promise<boolean>>();
const insert = vi.fn<(row: Record<string, unknown>) => Promise<{ error: null }>>();

vi.mock("@/lib/rate-limit", () => ({
  RATE_LIMITS: { otpPerIdentifier: { max: 5, windowSeconds: 3600 } },
  rateLimit: (...args: unknown[]) => rateLimit(...args),
}));

vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: () => ({ from: () => ({ insert }) }),
}));

let POST: (req: Request) => Promise<Response>;

beforeAll(async () => {
  vi.stubEnv("SUPABASE_SEND_SMS_HOOK_SECRET", `v1,whsec_${secretB64}`);
  vi.stubEnv("WHATSAPP_DRY_RUN", "true");
  ({ POST } = await import("@/app/api/auth/send-otp/route"));
});

beforeEach(() => {
  rateLimit.mockResolvedValue(true);
  insert.mockResolvedValue({ error: null });
  vi.spyOn(console, "info").mockImplementation(() => {});
  vi.spyOn(console, "error").mockImplementation(() => {});
});

afterEach(() => {
  vi.restoreAllMocks();
  rateLimit.mockReset();
  insert.mockReset();
});

function signedRequest(payload: unknown, secret = secretB64) {
  const body = JSON.stringify(payload);
  const id = `msg_${randomUUID()}`;
  const timestamp = new Date();
  const signature = new Webhook(secret).sign(id, timestamp, body);
  return new Request("http://localhost/api/auth/send-otp", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "webhook-id": id,
      "webhook-timestamp": String(Math.floor(timestamp.getTime() / 1000)),
      "webhook-signature": signature,
    },
    body,
  });
}

// Shape GoTrue sends: sms.phone is the destination (the new number on a phone change).
const payload = {
  user: { id: "u1", phone: "", new_phone: "919876543210", is_anonymous: true },
  sms: { otp: "123456", phone: "919876543210" },
};

describe("POST /api/auth/send-otp", () => {
  it("sends (dry run) and records a hashed event for a valid signature", async () => {
    const res = await POST(signedRequest(payload));
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({});

    expect(rateLimit).toHaveBeenCalledWith("otp-hook:phone", "+919876543210", expect.anything());
    expect(insert).toHaveBeenCalledTimes(1);
    const row = insert.mock.calls[0][0];
    expect(row).toMatchObject({ channel: "whatsapp", status: "dry_run", error: null });
    expect(row.recipient_hash).toMatch(/^[0-9a-f]{64}$/);
    expect(JSON.stringify(row)).not.toContain("9876543210");
    expect(JSON.stringify(row)).not.toContain("123456");
  });

  it("rejects a bad signature before doing anything", async () => {
    const res = await POST(signedRequest(payload, randomBytes(32).toString("base64")));
    expect(res.status).toBe(401);
    expect(rateLimit).not.toHaveBeenCalled();
    expect(insert).not.toHaveBeenCalled();
  });

  it("rejects a tampered body", async () => {
    const req = signedRequest(payload);
    const tampered = new Request(req.url, {
      method: "POST",
      headers: req.headers,
      body: JSON.stringify({ ...payload, sms: { ...payload.sms, otp: "000000" } }),
    });
    expect((await POST(tampered)).status).toBe(401);
  });

  it("rejects non-Indian numbers", async () => {
    const res = await POST(signedRequest({ ...payload, sms: { otp: "123456", phone: "15551234567" } }));
    expect(res.status).toBe(400);
    expect(insert).not.toHaveBeenCalled();
  });

  it("returns 429 when the per-phone limit is hit", async () => {
    rateLimit.mockResolvedValue(false);
    const res = await POST(signedRequest(payload));
    expect(res.status).toBe(429);
    const body = await res.json();
    expect(body.error.http_code).toBe(429);
    expect(insert).not.toHaveBeenCalled();
  });
});
