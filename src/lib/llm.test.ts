import { afterEach, describe, expect, it, vi } from "vitest";
import { llmConfig } from "@/lib/llm";

// llmConfig reads process.env at call time, so stubbing per test is enough —
// no module re-import dance needed.
afterEach(() => {
  vi.unstubAllEnvs();
});

describe("llmConfig", () => {
  it("returns null when no provider key is set", () => {
    vi.stubEnv("ZAI_API_KEY", "");
    vi.stubEnv("GEMINI_API_KEY", "");
    expect(llmConfig()).toBeNull();
  });

  it("prefers Z.ai when its key is set", () => {
    vi.stubEnv("ZAI_API_KEY", "test-key");
    vi.stubEnv("GEMINI_API_KEY", "also-set");
    expect(llmConfig()).toEqual({ provider: "zai", model: "glm-5-turbo" });
  });

  it("honors the ZAI_MODEL override", () => {
    vi.stubEnv("ZAI_API_KEY", "test-key");
    vi.stubEnv("ZAI_MODEL", "glm-5.2");
    expect(llmConfig()).toEqual({ provider: "zai", model: "glm-5.2" });
  });

  it("falls back to Gemini when only its key is set", () => {
    vi.stubEnv("ZAI_API_KEY", "");
    vi.stubEnv("GEMINI_API_KEY", "gem-key");
    expect(llmConfig()).toEqual({ provider: "gemini", model: "gemini-3.5-flash" });
  });
});
