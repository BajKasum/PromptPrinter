import { describe, expect, it, vi } from "vitest";
import { problem, rateLimitedProblem } from "./api-problem";

describe("problem", () => {
  it("antwortet als problem+json mit Titel, Status, Satz und Zusatzfeldern", async () => {
    const res = problem(403, "Nein.", { kind: "x" });
    expect(res.status).toBe(403);
    expect(res.headers.get("content-type")).toBe("application/problem+json");
    expect(await res.json()).toEqual({ type: "about:blank", title: "Forbidden", status: 403, detail: "Nein.", kind: "x" });
  });
});

describe("rateLimitedProblem", () => {
  it("trägt Art, Wartezeit in aufgerundeten Sekunden und denselben Wert im Kopf Retry-After", async () => {
    vi.useFakeTimers({ now: 1_000_000 });
    const res = rateLimitedProblem("Zu viele.", { resetAt: 1_000_000 + 41_200 });
    vi.useRealTimers();

    expect(res.status).toBe(429);
    expect(res.headers.get("content-type")).toBe("application/problem+json");
    expect(res.headers.get("retry-after")).toBe("42");
    expect(await res.json()).toEqual({
      type: "about:blank",
      title: "Too Many Requests",
      status: 429,
      detail: "Zu viele.",
      kind: "rate_limited",
      retryAfter: 42,
    });
  });

  it("schreibt nie eine negative Zahl in den Kopf", () => {
    vi.useFakeTimers({ now: 1_000_000 });
    const res = rateLimitedProblem("Zu viele.", { resetAt: 1_000_000 - 5_000 });
    vi.useRealTimers();
    expect(res.headers.get("retry-after")).toBe("0");
  });
});
