import { afterEach, describe, expect, it, vi } from "vitest";
import {
  buildCheckoutUrl,
  checkoutUrlFromEnv,
  normalizeCheckoutUrl,
} from "@/shared/lib/lemon-squeezy";

const REAL_CHECKOUT =
  "https://promptprinter.lemonsqueezy.com/checkout/buy/7a06a455-cd7d-49bb-abb3-c91adaf36e86?embed=1";

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("normalizeCheckoutUrl", () => {
  it("accepts the store's own checkout address", () => {
    expect(normalizeCheckoutUrl(REAL_CHECKOUT)).toBe(REAL_CHECKOUT);
  });

  it("accepts surrounding whitespace, which a copied value usually carries", () => {
    expect(normalizeCheckoutUrl(`  ${REAL_CHECKOUT}  `)).toBe(REAL_CHECKOUT);
  });

  it("treats missing configuration as a state, not an error", () => {
    expect(normalizeCheckoutUrl(undefined)).toBeNull();
    expect(normalizeCheckoutUrl(null)).toBeNull();
    expect(normalizeCheckoutUrl("")).toBeNull();
    expect(normalizeCheckoutUrl("   ")).toBeNull();
  });

  it("rejects anything that is not a URL instead of throwing at render time", () => {
    expect(normalizeCheckoutUrl("nope")).toBeNull();
    expect(normalizeCheckoutUrl("/checkout/buy/123")).toBeNull();
  });

  it("rejects http, the address carries payment traffic", () => {
    expect(normalizeCheckoutUrl("http://promptprinter.lemonsqueezy.com/checkout")).toBeNull();
  });

  it("rejects hosts that only look like Lemon Squeezy", () => {
    // Der Suffix-Vergleich muss auf dem Punkt bestehen, sonst würde jede
    // Domain durchgehen, die zufällig so endet.
    expect(normalizeCheckoutUrl("https://evil-lemonsqueezy.com/checkout")).toBeNull();
    expect(normalizeCheckoutUrl("https://lemonsqueezy.com.evil.test/checkout")).toBeNull();
    expect(normalizeCheckoutUrl("https://example.com/checkout")).toBeNull();
  });

  it("accepts the bare apex host too", () => {
    expect(normalizeCheckoutUrl("https://lemonsqueezy.com/checkout/buy/1")).toBe(
      "https://lemonsqueezy.com/checkout/buy/1"
    );
  });

  it("is case-insensitive about the host, as DNS is", () => {
    expect(normalizeCheckoutUrl("https://PromptPrinter.LemonSqueezy.com/checkout")).not.toBeNull();
  });
});

describe("checkoutUrlFromEnv", () => {
  it("reads the configured address", () => {
    vi.stubEnv("NEXT_PUBLIC_LEMONSQUEEZY_CHECKOUT_URL", REAL_CHECKOUT);
    expect(checkoutUrlFromEnv()).toBe(REAL_CHECKOUT);
  });

  it("returns null when unset, so callers can fall back", () => {
    vi.stubEnv("NEXT_PUBLIC_LEMONSQUEEZY_CHECKOUT_URL", "");
    expect(checkoutUrlFromEnv()).toBeNull();
  });
});

describe("buildCheckoutUrl", () => {
  it("passes null through, there is nothing to build from", () => {
    expect(buildCheckoutUrl(null)).toBeNull();
  });

  it("always requests the embed view, also for the no-JavaScript fallback", () => {
    const url = new URL(buildCheckoutUrl("https://x.lemonsqueezy.com/checkout/buy/1")!);
    expect(url.searchParams.get("embed")).toBe("1");
  });

  it("does not duplicate embed when the configured address already carries it", () => {
    const url = buildCheckoutUrl(REAL_CHECKOUT)!;
    expect(url.match(/embed=1/g)).toHaveLength(1);
  });

  it("prefills the buyer's mail and carries the account id as custom data", () => {
    const url = new URL(
      buildCheckoutUrl(REAL_CHECKOUT, { email: "a@b.test", userId: "user-42" })!
    );
    expect(url.searchParams.get("checkout[email]")).toBe("a@b.test");
    expect(url.searchParams.get("checkout[custom][user_id]")).toBe("user-42");
  });

  it("omits both when they are unknown, an anonymous visitor types them himself", () => {
    const url = new URL(buildCheckoutUrl(REAL_CHECKOUT, { email: null, userId: undefined })!);
    expect(url.searchParams.has("checkout[email]")).toBe(false);
    expect(url.searchParams.has("checkout[custom][user_id]")).toBe(false);
  });

  it("asks for the dark checkout only when the page is dark", () => {
    expect(new URL(buildCheckoutUrl(REAL_CHECKOUT, { dark: true })!).searchParams.get("dark")).toBe(
      "1"
    );
    expect(new URL(buildCheckoutUrl(REAL_CHECKOUT, { dark: false })!).searchParams.has("dark")).toBe(
      false
    );
  });

  it("keeps the path of the configured address untouched", () => {
    const url = new URL(buildCheckoutUrl(REAL_CHECKOUT, { dark: true })!);
    expect(url.pathname).toBe("/checkout/buy/7a06a455-cd7d-49bb-abb3-c91adaf36e86");
    expect(url.host).toBe("promptprinter.lemonsqueezy.com");
  });
});
