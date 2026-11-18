import { randomBytes } from "node:crypto";
import { afterEach, describe, expect, it, vi } from "vitest";
import { assertEnv, hasNoModelProvider, missingProductionEnv, modelEndpointProblem } from "@/server/env";

// Der Einzelbetrieb in der Startprüfung (server/self-hosted.ts): Upstash wird optional, sonst nichts.

const selfHosted: Record<string, string | undefined> = {
  NODE_ENV: "production",
  SELF_HOSTED: "1",
  NEXT_PUBLIC_SUPABASE_URL: "http://127.0.0.1:54321",
  NEXT_PUBLIC_SUPABASE_ANON_KEY: "anon",
  SUPABASE_SERVICE_ROLE_KEY: "service",
  NEXT_PUBLIC_APP_URL: "https://pp.example.org",
  API_KEY_ENCRYPTION_SECRET: randomBytes(32).toString("base64"),
  TRUSTED_PROXY_HOPS: "1",
  LLM_BASE_URL: "http://localhost:11434/v1",
  LLM_MODEL: "qwen3",
};

const names = (env: Record<string, string | undefined>) => missingProductionEnv(env).map((m) => m.name);

afterEach(() => vi.restoreAllMocks());

describe("missingProductionEnv im Einzelbetrieb", () => {
  it("verlangt Upstash nicht mehr", () => {
    expect(names(selfHosted)).toEqual([]);
  });

  it("verlangt alles andere weiter: Supabase, Service-Role, App-Adresse, Verschlüsselungs-Secret", () => {
    expect(names({ NODE_ENV: "production", SELF_HOSTED: "1" })).toEqual([
      "NEXT_PUBLIC_SUPABASE_URL",
      "NEXT_PUBLIC_SUPABASE_ANON_KEY",
      "SUPABASE_SERVICE_ROLE_KEY",
      "NEXT_PUBLIC_APP_URL",
      "API_KEY_ENCRYPTION_SECRET",
    ]);
  });

  it("verlangt Upstash ohne SELF_HOSTED=1 und auf Vercel wie bisher", () => {
    for (const env of [
      { ...selfHosted, SELF_HOSTED: undefined },
      { ...selfHosted, SELF_HOSTED: "true" },
      { ...selfHosted, VERCEL: "1" },
    ]) {
      expect(names(env)).toEqual(["UPSTASH_REDIS_REST_URL", "UPSTASH_REDIS_REST_TOKEN"]);
    }
  });
});

describe("assertEnv im Einzelbetrieb", () => {
  it("startet in Produktion ohne Upstash", () => {
    vi.spyOn(console, "warn").mockImplementation(() => {});
    expect(() => assertEnv(selfHosted)).not.toThrow();
  });

  it("bricht ohne SELF_HOSTED=1 ab, wenn Upstash fehlt (promptprinter.app bleibt so streng)", () => {
    vi.spyOn(console, "warn").mockImplementation(() => {});
    expect(() => assertEnv({ ...selfHosted, SELF_HOSTED: undefined })).toThrow(/UPSTASH_REDIS_REST_URL/);
  });

  it("bricht auf Vercel mit SELF_HOSTED=1 ab, statt den Wert still zu übergehen", () => {
    vi.spyOn(console, "warn").mockImplementation(() => {});
    expect(() => assertEnv({ ...selfHosted, VERCEL: "1" })).toThrow(/SELF_HOSTED=1/);
    // Auch mit Upstash und allem anderen: der Widerspruch allein reicht.
    const complete = { ...selfHosted, VERCEL: "1", UPSTASH_REDIS_REST_URL: "https://u", UPSTASH_REDIS_REST_TOKEN: "t" };
    expect(() => assertEnv(complete)).toThrow(/SELF_HOSTED=1/);
  });

  it("verlangt auch im Einzelbetrieb https für die App-Adresse, ausser mit ALLOW_INSECURE_APP_URL=1", () => {
    vi.spyOn(console, "warn").mockImplementation(() => {});
    const local = { ...selfHosted, NEXT_PUBLIC_APP_URL: "http://localhost:3000" };
    expect(() => assertEnv(local)).toThrow(/ALLOW_INSECURE_APP_URL/);
    expect(() => assertEnv({ ...local, ALLOW_INSECURE_APP_URL: "1" })).not.toThrow();
  });
});

describe("der eigene Modell-Endpunkt beim Start", () => {
  it("zählt als Anbieter nur mit Adresse und Modell", () => {
    expect(hasNoModelProvider({ LLM_BASE_URL: "http://localhost:11434/v1", LLM_MODEL: "qwen3" })).toBe(false);
    expect(hasNoModelProvider({ LLM_BASE_URL: "http://localhost:11434/v1" })).toBe(true);
    expect(hasNoModelProvider({ LLM_MODEL: "qwen3" })).toBe(true);
    expect(hasNoModelProvider({ LLM_BASE_URL: "  ", LLM_MODEL: "qwen3" })).toBe(true);
  });

  it("nennt, warum er ungenutzt bleibt", () => {
    expect(modelEndpointProblem({})).toBeNull();
    expect(modelEndpointProblem(selfHosted)).toBeNull();
    expect(modelEndpointProblem({ ...selfHosted, LLM_MODEL: "" })).toBe("no_model");
    expect(modelEndpointProblem({ ...selfHosted, ZAI_API_KEY: "zk" })).toBe("shadowed");
    expect(modelEndpointProblem({ ...selfHosted, GEMINI_API_KEY: "gk" })).toBe("shadowed");
    expect(modelEndpointProblem({ ...selfHosted, SELF_HOSTED: undefined })).toBe("needs_self_hosted");
    expect(modelEndpointProblem({ ...selfHosted, VERCEL: "1" })).toBe("needs_self_hosted");
    expect(
      modelEndpointProblem({ ...selfHosted, SELF_HOSTED: undefined, LLM_BASE_URL: "https://openrouter.ai/api/v1" })
    ).toBeNull();
  });

  it("warnt beim Start mit dem Grund, ohne abzubrechen", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    expect(() => assertEnv({ ...selfHosted, LLM_MODEL: "" })).not.toThrow();
    expect(warn.mock.calls.flat().join("\n")).toMatch(/LLM_BASE_URL ist gesetzt, wird aber nicht genutzt: LLM_MODEL fehlt/);
  });

  it("warnt nicht über den Stub-Modus, wenn der Endpunkt vollständig ist", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    assertEnv(selfHosted);
    expect(warn.mock.calls.flat().join("\n")).not.toMatch(/Stub-Modus|LLM_BASE_URL ist gesetzt/);
  });
});
