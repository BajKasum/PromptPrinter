import { afterEach, describe, expect, it, vi } from "vitest";
import {
  ANTHROPIC_DEFAULT_MODEL,
  GEMINI_DEFAULT_MODEL,
  OPENAI_DEFAULT_MODEL,
  ZAI_VISION_DEFAULT_MODEL,
  anthropicModel,
  geminiByokModel,
  llmConfig,
  openaiModel,
  serverConfigFor,
  zaiModelFor,
  zaiThinkingParams,
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

describe("Modelle der Nutzer-Keys (BYOK) sind per Umgebung überschreibbar", () => {
  const cases = [
    ["ANTHROPIC_MODEL", anthropicModel, ANTHROPIC_DEFAULT_MODEL],
    ["OPENAI_MODEL", openaiModel, OPENAI_DEFAULT_MODEL],
    ["GEMINI_MODEL", geminiByokModel, GEMINI_DEFAULT_MODEL],
  ] as const;

  for (const [name, model, fallback] of cases) {
    it(`${name}: ohne Wert gilt der Standard`, () => {
      vi.stubEnv(name, "");
      expect(model()).toBe(fallback);
    });

    for (const blank of BLANK_VALUES) {
      it(`${name}=${JSON.stringify(blank)} ergibt den Standard, nicht ein leeres Modell`, () => {
        vi.stubEnv(name, blank);
        expect(model()).toBe(fallback);
      });
    }

    it(`${name}: ein gesetzter Name gewinnt, Leerraum drumherum zählt nicht dazu`, () => {
      vi.stubEnv(name, " neues-modell\n");
      expect(model()).toBe("neues-modell");
    });
  }

  it("ein Gemini-Zug mit eigenem Key und der Server-Anbieter lesen dieselbe Variable", () => {
    vi.stubEnv("ZAI_API_KEY", "");
    vi.stubEnv("GEMINI_API_KEY", "gk");
    vi.stubEnv("GEMINI_MODEL", "gemini-x");
    expect(geminiByokModel()).toBe(llmConfig()?.model);
  });
});

describe("Denken bei Z.ai", () => {
  it("schaltet es bei den Modellen bis glm-5.2 ab", () => {
    for (const model of ["glm-4.5-air", "glm-4.6v", "glm-4.7", "glm-5", "glm-5-turbo", "glm-5.2"]) {
      expect(zaiThinkingParams(model), model).toEqual({ thinking: { type: "disabled" } });
    }
  });

  it("setzt es bei Modellen, die immer denken (glm-5.3 und neuer), auf low statt es abzuschalten (sonst 400)", () => {
    for (const model of ["glm-5.3", "glm-5.3-flash", "glm-5.3-flashx", "glm-5.10", "glm-6"]) {
      expect(zaiThinkingParams(model), model).toEqual({ reasoning_effort: "low" });
    }
  });
});
