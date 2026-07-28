import { afterEach, describe, expect, it, vi } from "vitest";
import { captureError, logEvent, logWarning, redactContext } from "@/lib/observability";

// QA finding C-7. The privacy half matters as much as the telemetry half: the
// moment a log drain is configured, everything these functions emit leaves the
// machine, and the most sensitive thing this product touches is exactly what a
// careless call site would attach — the user's prompt and the model's reply.

describe("redactContext", () => {
  it("redacts message content rather than dropping the key", () => {
    const safe = redactContext({ content: "meine geheime Produktidee" });
    expect(safe.content).toBe("[redacted]");
  });

  it.each(["content", "messages", "prompt", "reply", "text", "instructions", "idea"])(
    "redacts %s, the fields that carry what was actually said",
    (key) => {
      expect(redactContext({ [key]: "…" })[key]).toBe("[redacted]");
    }
  );

  it.each(["apiKey", "api_key", "token", "password", "secret", "authorization"])(
    "redacts %s, so a credential never reaches a log drain",
    (key) => {
      expect(redactContext({ [key]: "sk-live-123" })[key]).toBe("[redacted]");
    }
  );

  it("keeps the operational fields that make a log line useful", () => {
    const safe = redactContext({
      userId: "user-1",
      latencyMs: 1234,
      provider: "zai",
      byok: false,
    });
    expect(safe).toEqual({ userId: "user-1", latencyMs: 1234, provider: "zai", byok: false });
  });

  it("reduces an array to its length instead of logging its entries", () => {
    expect(redactContext({ items: ["a", "b", "c"] }).items).toEqual({ count: 3 });
  });

  it("truncates long free text, which is content by another name", () => {
    const safe = redactContext({ note: "x".repeat(500) });
    expect(safe.note).toContain("500 Zeichen");
    expect(String(safe.note).length).toBeLessThan(100);
  });

  it("recurses into nested objects", () => {
    const safe = redactContext({ request: { prompt: "geheim", turns: 3 } });
    expect(safe.request).toEqual({ prompt: "[redacted]", turns: 3 });
  });
});

describe("emitters", () => {
  afterEach(() => vi.restoreAllMocks());

  it("writes one JSON line carrying level, event and timestamp", () => {
    const log = vi.spyOn(console, "log").mockImplementation(() => {});
    logEvent("chat.turn", { latencyMs: 42 });

    const parsed = JSON.parse(log.mock.calls[0][0] as string);
    expect(parsed).toMatchObject({ level: "info", event: "chat.turn", latencyMs: 42 });
    expect(typeof parsed.ts).toBe("string");
  });

  it("routes warnings to console.warn", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    logWarning("spend_guard.budget_exhausted", { used: 1001 });
    expect(JSON.parse(warn.mock.calls[0][0] as string).level).toBe("warn");
  });

  it("redacts on the way out, not only when the caller remembers to", () => {
    const log = vi.spyOn(console, "log").mockImplementation(() => {});
    logEvent("chat.turn", { content: "die eigentliche Nachricht" });
    expect(JSON.parse(log.mock.calls[0][0] as string).content).toBe("[redacted]");
  });
});

describe("captureError", () => {
  afterEach(() => vi.restoreAllMocks());

  it("records the message and type without the surrounding context leaking", () => {
    const error = vi.spyOn(console, "error").mockImplementation(() => {});
    captureError("chat.turn_failed", new TypeError("boom"), { userId: "user-1", prompt: "geheim" });

    const parsed = JSON.parse(error.mock.calls[0][0] as string);
    expect(parsed).toMatchObject({
      level: "error",
      event: "chat.turn_failed",
      error: "boom",
      errorType: "TypeError",
      userId: "user-1",
      prompt: "[redacted]",
    });
  });

  it("keeps a bounded stack, which is file paths rather than user data", () => {
    const error = vi.spyOn(console, "error").mockImplementation(() => {});
    captureError("chat.turn_failed", new Error("boom"));

    const parsed = JSON.parse(error.mock.calls[0][0] as string);
    expect(parsed.stack).toContain("Error: boom");
    expect(parsed.stack.split(" | ").length).toBeLessThanOrEqual(5);
  });

  it("survives a non-Error being thrown", () => {
    const error = vi.spyOn(console, "error").mockImplementation(() => {});
    captureError("chat.turn_failed", "irgendwas");

    const parsed = JSON.parse(error.mock.calls[0][0] as string);
    expect(parsed).toMatchObject({ error: "irgendwas", errorType: "string" });
  });
});
