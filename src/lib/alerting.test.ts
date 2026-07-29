import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// Security-Audit finding M-4. The module reads its config at import time, so
// each test sets the environment and then re-imports it fresh.
const WEBHOOK = "https://hooks.example.test/abc";

async function loadAlerting(env: Record<string, string | undefined>) {
  vi.resetModules();
  for (const [key, value] of Object.entries(env)) {
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  }
  return import("./alerting");
}

const originalEnv = { ...process.env };

beforeEach(() => {
  vi.restoreAllMocks();
});

afterEach(() => {
  process.env = { ...originalEnv };
  vi.unstubAllGlobals();
});

describe("dispatchAlert", () => {
  it("does nothing when no webhook is configured", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    const { dispatchAlert } = await loadAlerting({
      ALERT_WEBHOOK_URL: undefined,
      UPSTASH_REDIS_REST_URL: undefined,
      UPSTASH_REDIS_REST_TOKEN: undefined,
    });

    await dispatchAlert("error", "chat.turn_failed", { userId: "u1" });

    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("posts the event to the configured webhook", async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response("ok"));
    vi.stubGlobal("fetch", fetchMock);
    const { dispatchAlert } = await loadAlerting({
      ALERT_WEBHOOK_URL: WEBHOOK,
      UPSTASH_REDIS_REST_URL: undefined,
      UPSTASH_REDIS_REST_TOKEN: undefined,
    });

    await dispatchAlert("error", "chat.turn_failed", { userId: "u1" });

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe(WEBHOOK);
    const body = JSON.parse((init as RequestInit).body as string);
    expect(body).toMatchObject({
      level: "error",
      event: "chat.turn_failed",
      context: { userId: "u1" },
    });
  });

  // A provider outage produces one captureError per request. Without a throttle
  // the webhook would fire thousands of times and get muted by a human —
  // exactly when it matters most.
  it("throttles repeats of the same event", async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response("ok"));
    vi.stubGlobal("fetch", fetchMock);
    const { dispatchAlert } = await loadAlerting({
      ALERT_WEBHOOK_URL: WEBHOOK,
      UPSTASH_REDIS_REST_URL: undefined,
      UPSTASH_REDIS_REST_TOKEN: undefined,
    });

    for (let i = 0; i < 5; i++) {
      await dispatchAlert("error", "chat.turn_failed", {});
    }

    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  // Keyed per event name, so a chat outage muting itself must not suppress an
  // unrelated spend-guard alert.
  it("throttles per event, not globally", async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response("ok"));
    vi.stubGlobal("fetch", fetchMock);
    const { dispatchAlert } = await loadAlerting({
      ALERT_WEBHOOK_URL: WEBHOOK,
      UPSTASH_REDIS_REST_URL: undefined,
      UPSTASH_REDIS_REST_TOKEN: undefined,
    });

    await dispatchAlert("error", "chat.turn_failed", {});
    await dispatchAlert("error", "chat.turn_failed", {});
    await dispatchAlert("warning", "spend_guard.budget_exhausted", {});

    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  // Alerting sits on a request path. A broken endpoint must never surface as a
  // failed chat turn.
  it("swallows a failing webhook instead of throwing", async () => {
    const fetchMock = vi.fn().mockRejectedValue(new Error("network down"));
    vi.stubGlobal("fetch", fetchMock);
    const { dispatchAlert } = await loadAlerting({
      ALERT_WEBHOOK_URL: WEBHOOK,
      UPSTASH_REDIS_REST_URL: undefined,
      UPSTASH_REDIS_REST_TOKEN: undefined,
    });

    await expect(dispatchAlert("error", "chat.turn_failed", {})).resolves.toBeUndefined();
  });
});

describe("alertingConfigured", () => {
  it("is false without a webhook", async () => {
    const { alertingConfigured } = await loadAlerting({ ALERT_WEBHOOK_URL: undefined });
    expect(alertingConfigured()).toBe(false);
  });

  it("is true with one", async () => {
    const { alertingConfigured } = await loadAlerting({ ALERT_WEBHOOK_URL: WEBHOOK });
    expect(alertingConfigured()).toBe(true);
  });
});
