import { describe, expect, it } from "vitest";
import { rateLimitKey } from "@/lib/rate-limit";

function req(headers: Record<string, string> = {}) {
  return new Request("https://promptprinter.app/api/chat", { headers });
}

describe("rateLimitKey", () => {
  it("keys by user id when present, ignoring headers", () => {
    expect(rateLimitKey(req({ "x-forwarded-for": "1.2.3.4" }), "user-123")).toBe(
      "u:user-123"
    );
  });

  it("falls back to the ip when userId is null", () => {
    expect(rateLimitKey(req({ "x-forwarded-for": "1.2.3.4" }), null)).toBe("ip:1.2.3.4");
  });

  it("takes the first x-forwarded-for entry and trims it", () => {
    expect(rateLimitKey(req({ "x-forwarded-for": "  9.9.9.9 , 8.8.8.8 " }))).toBe(
      "ip:9.9.9.9"
    );
  });

  it("uses cf-connecting-ip when there is no x-forwarded-for", () => {
    expect(rateLimitKey(req({ "cf-connecting-ip": "5.5.5.5" }))).toBe("ip:5.5.5.5");
  });

  it('falls back to "unknown" without any ip headers', () => {
    expect(rateLimitKey(req())).toBe("ip:unknown");
  });
});
