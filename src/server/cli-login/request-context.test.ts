import { afterEach, describe, expect, it, vi } from "vitest";
import { requestContext } from "@/server/cli-login/request-context";

const req = (headers: Record<string, string> = {}) => new Request("https://promptprinter.app/api/cli/device", { headers });

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("requestContext", () => {
  it("nimmt auf Vercel Adresse, Ort und Programm aus den Köpfen", () => {
    vi.stubEnv("VERCEL", "1");
    expect(
      requestContext(
        req({
          "x-vercel-forwarded-for": "203.0.113.7",
          "x-vercel-ip-city": "Z%C3%BCrich",
          "x-vercel-ip-country": "CH",
          "user-agent": "promptprinter-cli/1.0 (linux)",
        })
      )
    ).toEqual({ ip: "203.0.113.7", location: "Zürich, CH", userAgent: "promptprinter-cli/1.0 (linux)" });
  });

  it("glaubt ausserhalb von Vercel keinem Ort: den Kopf setzt dort der Aufrufer selbst", () => {
    vi.stubEnv("VERCEL", "");
    vi.stubEnv("TRUSTED_PROXY_HOPS", "");
    expect(requestContext(req({ "x-vercel-ip-city": "Fake", "x-vercel-ip-country": "XX", "x-forwarded-for": "1.2.3.4" }))).toEqual({
      ip: null,
      location: null,
      userAgent: null,
    });
  });

  it("bereinigt das Programm: keine Steuerzeichen, begrenzte Länge", () => {
    const { userAgent } = requestContext(req({ "user-agent": `gut\u0007böse ${"x".repeat(300)}` }));
    expect(userAgent).toMatch(/^gut böse x+$/);
    expect(userAgent!.length).toBeLessThanOrEqual(120);
  });

  it("lässt einen kaputt kodierten Ort weg, das Land bleibt", () => {
    vi.stubEnv("VERCEL", "1");
    expect(requestContext(req({ "x-vercel-ip-city": "%E0%A4%A", "x-vercel-ip-country": "CH" })).location).toBe("CH");
  });

  it("gibt null statt eines leeren Texts", () => {
    vi.stubEnv("VERCEL", "1");
    expect(requestContext(req({ "x-vercel-forwarded-for": "203.0.113.7" }))).toEqual({
      ip: "203.0.113.7",
      location: null,
      userAgent: null,
    });
  });
});
