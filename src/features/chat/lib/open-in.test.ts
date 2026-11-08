import { describe, expect, it } from "vitest";
import { openTargetFor } from "./open-in";

describe("In ChatGPT oder Claude öffnen", () => {
  it("öffnet beide leer: der Prompt kommt über die Zwischenablage, nie über die Adresse", () => {
    expect(openTargetFor("chatgpt")).toEqual({ url: "https://chatgpt.com/" });
    expect(openTargetFor("claude")).toEqual({ url: "https://claude.ai/new" });
  });
});
