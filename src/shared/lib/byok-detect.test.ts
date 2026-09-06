import { describe, expect, it } from "vitest";
import { detectProviderFromKey } from "./byok-detect";

describe("detectProviderFromKey", () => {
  it("erkennt einen Anthropic-Key", () => {
    expect(detectProviderFromKey("sk-ant-api03-abcdefg")).toBe("anthropic");
  });

  it("erkennt einen OpenAI-Key am generischen sk--Praefix", () => {
    expect(detectProviderFromKey("sk-proj-abcdefg")).toBe("openai");
  });

  it("erkennt einen Gemini-Key am AIza-Praefix", () => {
    expect(detectProviderFromKey("AIzaSyD-abcdefg")).toBe("gemini");
  });

  // Anthropic-Keys beginnen ebenfalls mit dem generischen "sk-", das
  // Anthropic-spezifische "sk-ant-" muss deshalb VOR dem generischen Fall
  // geprueft werden, sonst waere jeder Anthropic-Key faelschlich "openai".
  it("verwechselt einen Anthropic-Key nicht mit einem generischen sk--Key", () => {
    expect(detectProviderFromKey("sk-ant-xyz")).toBe("anthropic");
    expect(detectProviderFromKey("sk-ant-xyz")).not.toBe("openai");
  });

  it("erkennt einen unbekannten Praefix nicht", () => {
    expect(detectProviderFromKey("glm-abcdefg")).toBeNull();
    expect(detectProviderFromKey("")).toBeNull();
  });

  it("ignoriert Leerraum am Rand", () => {
    expect(detectProviderFromKey("  sk-ant-abc  ")).toBe("anthropic");
  });
});
