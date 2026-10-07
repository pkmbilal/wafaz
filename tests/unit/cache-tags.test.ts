import { describe, expect, it } from "vitest";
import { cacheTags } from "@/lib/cache-tags";

describe("cacheTags", () => {
  it("builds scoped tag names", () => {
    expect(cacheTags.product("abc")).toBe("product:abc");
    expect(cacheTags.collection("new-arrivals")).toBe("collection:new-arrivals");
    expect(cacheTags.page("about")).toBe("page:about");
    expect(cacheTags.catalog).toBe("catalog");
  });
});
