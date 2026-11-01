import { describe, expect, it, vi, beforeEach } from "vitest";
import { isForbiddenCrossOriginApiCall } from "./request-origin";

const SITE = "https://promptprinter.app";

function call(path: string, method: string, headers: Record<string, string> = {}) {
  return isForbiddenCrossOriginApiCall(new Request(`${SITE}${path}`, { method, headers }), path);
}

beforeEach(() => {
  vi.stubEnv("NEXT_PUBLIC_APP_URL", SITE);
});

describe("isForbiddenCrossOriginApiCall", () => {
  it.each(["cross-site", "same-site"])("weist Sec-Fetch-Site: %s ab", (site) => {
    expect(call("/api/projects", "POST", { "sec-fetch-site": site })).toBe(true);
  });

  it.each(["same-origin", "none"])("lässt Sec-Fetch-Site: %s durch", (site) => {
    expect(call("/api/projects", "POST", { "sec-fetch-site": site })).toBe(false);
  });

  it("Sec-Fetch-Site gewinnt: auch die eigene Origin hilft einer seitenfremden Anfrage nicht", () => {
    expect(call("/api/projects", "POST", { "sec-fetch-site": "cross-site", origin: SITE })).toBe(true);
  });

  it("entscheidet ohne Sec-Fetch-Site nach Origin", () => {
    expect(call("/api/projects", "POST", { origin: "https://evil.example" })).toBe(true);
    expect(call("/api/projects", "POST", { origin: "null" })).toBe(true);
    expect(call("/api/projects", "POST", { origin: SITE })).toBe(false);
  });

  it("lässt eine Anfrage ohne beide Köpfe durch: das ist kein Browser", () => {
    expect(call("/api/projects", "POST")).toBe(false);
  });

  it.each(["POST", "PUT", "PATCH", "DELETE"])("gilt für %s", (method) => {
    expect(call("/api/settings/api-key", method, { origin: "https://evil.example" })).toBe(true);
  });

  it.each(["GET", "HEAD", "OPTIONS"])("lässt %s durch, das ändert nichts", (method) => {
    expect(call("/api/settings/api-key", method, { origin: "https://evil.example" })).toBe(false);
  });

  it("gilt nur unter /api/", () => {
    expect(call("/login", "POST", { origin: "https://evil.example" })).toBe(false);
  });

  it.each([
    "/api/webhooks/lemonsqueezy",
    "/api/cli/device",
    "/api/cli/token",
    "/api/cli/refresh",
    "/api/cli/logout",
  ])("nimmt %s aus", (path) => {
    expect(call(path, "POST", { origin: "https://evil.example" })).toBe(false);
  });

  it("nimmt die Freigabe im Browser nicht aus: sie nutzt das Cookie", () => {
    expect(call("/api/cli/approve", "POST", { origin: "https://evil.example" })).toBe(true);
  });

  it("nimmt nur exakte Pfade aus, kein Präfix", () => {
    expect(call("/api/cli/token/x", "POST", { origin: "https://evil.example" })).toBe(true);
  });

  it("nimmt Aufrufe mit Bearer aus, andere Schemata nicht", () => {
    const foreign = { origin: "https://evil.example" };
    expect(call("/api/chat", "POST", { ...foreign, authorization: "Bearer abc" })).toBe(false);
    expect(call("/api/chat", "POST", { ...foreign, authorization: "Basic abc" })).toBe(true);
  });
});
