import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  cancelSubscriptionImmediately,
  lemonSqueezyApiConfigured,
} from "@/server/billing/lemonsqueezy-api";

const captureError = vi.fn();
const logWarning = vi.fn();

vi.mock("@/shared/lib/observability", () => ({
  captureError: (...a: unknown[]) => captureError(...a),
  logWarning: (...a: unknown[]) => logWarning(...a),
}));

describe("lemonSqueezyApiConfigured", () => {
  it("is false without a key, true with one", () => {
    expect(lemonSqueezyApiConfigured({})).toBe(false);
    expect(lemonSqueezyApiConfigured({ LEMON_SQUEEZY_API_KEY: "  " })).toBe(false);
    expect(lemonSqueezyApiConfigured({ LEMON_SQUEEZY_API_KEY: "sk_live" })).toBe(true);
  });
});

// K-5 (Audit 06.09.2026): die einzige Stelle, die ein Lemon-Squeezy-Abo
// wirklich beendet statt nur einen bereits eingetretenen Zustand zu lesen.
describe("cancelSubscriptionImmediately", () => {
  const ORIGINAL_KEY = process.env.LEMON_SQUEEZY_API_KEY;

  beforeEach(() => {
    captureError.mockClear();
    logWarning.mockClear();
    vi.stubGlobal("fetch", vi.fn());
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    if (ORIGINAL_KEY === undefined) delete process.env.LEMON_SQUEEZY_API_KEY;
    else process.env.LEMON_SQUEEZY_API_KEY = ORIGINAL_KEY;
  });

  it("skips the API call entirely without a configured key, ohne zu scheitern", async () => {
    delete process.env.LEMON_SQUEEZY_API_KEY;

    const result = await cancelSubscriptionImmediately("sub_1");

    expect(result).toEqual({ ok: true, skipped: true });
    expect(fetch).not.toHaveBeenCalled();
  });

  it("ruft die Lemon-Squeezy-API mit DELETE und dem Bearer-Token auf", async () => {
    process.env.LEMON_SQUEEZY_API_KEY = "sk_live_123";
    vi.mocked(fetch).mockResolvedValue(new Response(null, { status: 200 }));

    const result = await cancelSubscriptionImmediately("sub_1");

    expect(result).toEqual({ ok: true, skipped: false });
    const [url, init] = vi.mocked(fetch).mock.calls[0] as [string, RequestInit];
    expect(url).toBe("https://api.lemonsqueezy.com/v1/subscriptions/sub_1");
    expect(init.method).toBe("DELETE");
    expect((init.headers as Record<string, string>).Authorization).toBe("Bearer sk_live_123");
  });

  it("behandelt 404 (Abo existiert dort nicht mehr) als Erfolg", async () => {
    process.env.LEMON_SQUEEZY_API_KEY = "sk_live_123";
    vi.mocked(fetch).mockResolvedValue(new Response(null, { status: 404 }));

    const result = await cancelSubscriptionImmediately("sub_1");

    expect(result).toEqual({ ok: true, skipped: false });
    expect(logWarning).not.toHaveBeenCalled();
  });

  it("meldet einen Fehler bei jedem anderen Nicht-2xx, wirft aber nicht", async () => {
    process.env.LEMON_SQUEEZY_API_KEY = "sk_live_123";
    vi.mocked(fetch).mockResolvedValue(
      new Response("nope", { status: 401, statusText: "Unauthorized" })
    );

    const result = await cancelSubscriptionImmediately("sub_1");

    expect(result.ok).toBe(false);
    expect(logWarning).toHaveBeenCalledWith(
      "billing.subscription_cancel_failed",
      expect.objectContaining({ subscriptionId: "sub_1", status: 401 })
    );
  });

  it("faengt eine unerreichbare API ab, statt zu werfen", async () => {
    process.env.LEMON_SQUEEZY_API_KEY = "sk_live_123";
    vi.mocked(fetch).mockRejectedValue(new TypeError("fetch failed"));

    const result = await cancelSubscriptionImmediately("sub_1");

    expect(result.ok).toBe(false);
    expect(captureError).toHaveBeenCalledWith(
      "billing.subscription_cancel_unreachable",
      expect.anything(),
      { subscriptionId: "sub_1" }
    );
  });
});
