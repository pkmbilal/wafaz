import { describe, expect, it } from "vitest";
import { isNewOrder } from "@/lib/orders/labels";

describe("isNewOrder", () => {
  it("is new while a confirmed order is unpacked", () => {
    expect(isNewOrder({ orderStatus: "confirmed", fulfillmentStatus: "unfulfilled" })).toBe(true);
  });

  it.each([
    ["confirmed", "packed"],
    ["confirmed", "shipped"],
    ["pending_payment", "unfulfilled"],
    ["expired", "unfulfilled"],
    ["cancelled", "unfulfilled"],
  ] as const)("is not new when %s / %s", (orderStatus, fulfillmentStatus) => {
    expect(isNewOrder({ orderStatus, fulfillmentStatus })).toBe(false);
  });
});
