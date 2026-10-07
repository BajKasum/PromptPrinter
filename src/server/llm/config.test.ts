import { afterEach, describe, expect, it, vi } from "vitest";
import {
  GEMINI_DEFAULT_MODEL,
  ZAI_VISION_DEFAULT_MODEL,
  llmConfig,
  serverConfigFor,
  zaiModelFor,
} from "@/server/llm/config";

// Optionale Umgebungswerte (Betriebs-Audit, Folgesitzung 2026-10-07): ein LEER
// gesetztes `ZAI_MODEL=` ergab wegen `??` ein leeres Modell statt des Standards, und
// jede Anfrage ging mit "model": "" an den Anbieter. Leer und nur Leerzeichen zählen
// wie "nicht gesetzt", dieselbe Linie wie `env.ts` (isBlank) und `llm-failover.ts`.

afterEach(() => {
  vi.unstubAllEnvs();
});

const BLANK_VALUES = ["", "   ", "\n"];

describe("Modellnamen aus der Umgebung", () => {
  for (const blank of BLANK_VALUES) {
    const shown = JSON.stringify(blank);

    it(`llmConfig: ZAI_MODEL=${shown} ergibt das Standardmodell, nicht ein leeres`, () => {
      vi.stubEnv("ZAI_API_KEY", "zk");
      vi.stubEnv("ZAI_MODEL", blank);
      expect(llmConfig()).toEqual({ provider: "zai", model: "glm-4.5-air" });
    });

    it(`llmConfig: GEMINI_MODEL=${shown} ergibt das Standardmodell`, () => {
      vi.stubEnv("ZAI_API_KEY", "");
      vi.stubEnv("GEMINI_API_KEY", "gk");
      vi.stubEnv("GEMINI_MODEL", blank);
      expect(llmConfig()).toEqual({ provider: "gemini", model: GEMINI_DEFAULT_MODEL });
    });

    it(`serverConfigFor: ZAI_MODEL=${shown} und GEMINI_MODEL=${shown} ergeben die Standardmodelle`, () => {
      vi.stubEnv("ZAI_API_KEY", "zk");
      vi.stubEnv("GEMINI_API_KEY", "gk");
      vi.stubEnv("ZAI_MODEL", blank);
      vi.stubEnv("GEMINI_MODEL", blank);
      expect(serverConfigFor("zai")).toEqual({ provider: "zai", model: "glm-4.5-air" });
      expect(serverConfigFor("gemini")).toEqual({ provider: "gemini", model: GEMINI_DEFAULT_MODEL });
    });

    it(`zaiModelFor: ZAI_VISION_MODEL=${shown} ergibt das sehende Standardmodell`, () => {
      vi.stubEnv("ZAI_VISION_MODEL", blank);
      const withImage = [{ role: "user" as const, content: "x", images: [{ mediaType: "image/png" as const, base64: "QQ==" }] }];
      expect(zaiModelFor("glm-4.5-air", withImage)).toBe(ZAI_VISION_DEFAULT_MODEL);
    });
  }

  it("ein gesetzter Name gewinnt, Leerraum drumherum zählt nicht dazu", () => {
    vi.stubEnv("ZAI_API_KEY", "zk");
    vi.stubEnv("ZAI_MODEL", " glm-5.2\n");
    expect(llmConfig()).toEqual({ provider: "zai", model: "glm-5.2" });
  });
});

describe("Schlüssel aus nur Leerzeichen zählen als nicht gesetzt", () => {
  it("llmConfig: ein Z.ai-Schlüssel aus Leerzeichen schaltet nicht auf Z.ai, sondern auf Gemini", () => {
    vi.stubEnv("ZAI_API_KEY", "   ");
    vi.stubEnv("GEMINI_API_KEY", "gk");
    expect(llmConfig()).toEqual({ provider: "gemini", model: GEMINI_DEFAULT_MODEL });
  });

  it("llmConfig: zwei Schlüssel aus Leerzeichen ergeben keinen Anbieter (Stub-Modus)", () => {
    vi.stubEnv("ZAI_API_KEY", "  ");
    vi.stubEnv("GEMINI_API_KEY", "\n");
    expect(llmConfig()).toBeNull();
  });

  it("serverConfigFor: ein Schlüssel aus Leerzeichen ist kein Failover-Ziel", () => {
    vi.stubEnv("ZAI_API_KEY", "zk");
    vi.stubEnv("GEMINI_API_KEY", "  ");
    expect(serverConfigFor("gemini")).toBeNull();
    vi.stubEnv("ZAI_API_KEY", "  ");
    vi.stubEnv("GEMINI_API_KEY", "gk");
    expect(serverConfigFor("zai")).toBeNull();
  });
});
