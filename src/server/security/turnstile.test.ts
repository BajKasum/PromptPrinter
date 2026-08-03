import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { verifyTurnstileToken, turnstileEnabled, MAX_TURNSTILE_TOKEN_CHARS } from "./turnstile";

// The module this covers is the whole reason the captcha stopped being
// decorative, so the cases that matter are the failure ones: a wrong secret, an
// unreachable Cloudflare, a garbage body. Each has to end in "no", not in an
// exception that some caller might treat as a pass.

const captureError = vi.fn();
vi.mock("@/shared/lib/observability", () => ({
  captureError: (...args: unknown[]) => captureError(...args),
}));

const fetchMock = vi.fn();

function siteverifyResponds(body: unknown, init: { ok?: boolean; status?: number } = {}) {
  fetchMock.mockResolvedValue({
    ok: init.ok ?? true,
    status: init.status ?? 200,
    json: async () => body,
  });
}

describe("verifyTurnstileToken", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubGlobal("fetch", fetchMock);
    vi.stubEnv("TURNSTILE_SECRET", "0x-test-secret");
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.unstubAllEnvs();
  });

  it("accepts a token Cloudflare confirms", async () => {
    siteverifyResponds({ success: true });
    await expect(verifyTurnstileToken("good-token")).resolves.toEqual({ ok: true, skipped: false });
  });

  it("posts the secret and token form-encoded to the canonical endpoint", async () => {
    siteverifyResponds({ success: true });
    await verifyTurnstileToken("good-token", "203.0.113.7");

    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe("https://challenges.cloudflare.com/turnstile/v0/siteverify");
    expect(init.method).toBe("POST");
    const sent = init.body as URLSearchParams;
    expect(sent.get("secret")).toBe("0x-test-secret");
    expect(sent.get("response")).toBe("good-token");
    expect(sent.get("remoteip")).toBe("203.0.113.7");
  });

  it("omits remoteip when the caller's address could not be determined", async () => {
    siteverifyResponds({ success: true });
    await verifyTurnstileToken("good-token", "unknown");
    const sent = (fetchMock.mock.calls[0] as [string, RequestInit])[1].body as URLSearchParams;
    expect(sent.has("remoteip")).toBe(false);
  });

  it("rejects and reports the reason Cloudflare gave", async () => {
    siteverifyResponds({ success: false, "error-codes": ["timeout-or-duplicate"] });
    await expect(verifyTurnstileToken("spent-token")).resolves.toEqual({
      ok: false,
      reason: "timeout-or-duplicate",
    });
  });

  it("flags a rejected secret as an operator problem, not a bot", async () => {
    siteverifyResponds({ success: false, "error-codes": ["invalid-input-secret"] });
    const result = await verifyTurnstileToken("any-token");
    expect(result.ok).toBe(false);
    expect(captureError).toHaveBeenCalledWith(
      "turnstile.secret_rejected",
      expect.any(Error),
      expect.objectContaining({ codes: ["invalid-input-secret"] })
    );
  });

  it("fails closed when siteverify is unreachable", async () => {
    fetchMock.mockRejectedValue(new Error("ECONNRESET"));
    await expect(verifyTurnstileToken("good-token")).resolves.toEqual({
      ok: false,
      reason: "siteverify-unreachable",
    });
    expect(captureError).toHaveBeenCalledWith("turnstile.siteverify_unreachable", expect.any(Error));
  });

  it("fails closed on a non-2xx answer", async () => {
    siteverifyResponds({}, { ok: false, status: 502 });
    const result = await verifyTurnstileToken("good-token");
    expect(result).toEqual({ ok: false, reason: "siteverify-unreachable" });
  });

  it("fails closed on a body that is not JSON", async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => {
        throw new SyntaxError("Unexpected token <");
      },
    });
    const result = await verifyTurnstileToken("good-token");
    expect(result).toEqual({ ok: false, reason: "siteverify-unreachable" });
  });

  it("rejects a missing token without spending a network call", async () => {
    await expect(verifyTurnstileToken(null)).resolves.toEqual({
      ok: false,
      reason: "missing-input-response",
    });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("rejects an oversized token without relaying it", async () => {
    const huge = "x".repeat(MAX_TURNSTILE_TOKEN_CHARS + 1);
    await expect(verifyTurnstileToken(huge)).resolves.toEqual({
      ok: false,
      reason: "missing-input-response",
    });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("skips verification entirely when no secret is configured", async () => {
    vi.stubEnv("TURNSTILE_SECRET", "");
    await expect(verifyTurnstileToken("good-token")).resolves.toEqual({ ok: true, skipped: true });
    expect(fetchMock).not.toHaveBeenCalled();
  });
});

describe("turnstileEnabled", () => {
  it("is false for an unset or whitespace-only secret", () => {
    expect(turnstileEnabled({})).toBe(false);
    expect(turnstileEnabled({ TURNSTILE_SECRET: "   " })).toBe(false);
  });

  it("is true once a secret is present", () => {
    expect(turnstileEnabled({ TURNSTILE_SECRET: "0x-secret" })).toBe(true);
  });
});
