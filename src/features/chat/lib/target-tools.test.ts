import { describe, expect, it } from "vitest";
import { MAX_TARGET_LENGTH, TARGET_TOOLS, normalizeTarget } from "@/features/chat/lib/target-tools";
import { chatRequestSchema } from "@/shared/lib/schemas";

// QA finding F-3: `target` was wired through the whole stack with no way to set
// it. These pin the normalization the UI and the route now share, and that the
// values the picker offers actually survive the request contract.

describe("normalizeTarget", () => {
  it("collapses every flavour of empty to undefined", () => {
    expect(normalizeTarget(undefined)).toBeUndefined();
    expect(normalizeTarget(null)).toBeUndefined();
    expect(normalizeTarget("")).toBeUndefined();
    expect(normalizeTarget("   ")).toBeUndefined();
  });

  it("trims surrounding whitespace", () => {
    expect(normalizeTarget("  Cursor  ")).toBe("Cursor");
  });

  it("caps a pasted overlong value at the schema's own ceiling", () => {
    expect(normalizeTarget("x".repeat(200))).toHaveLength(MAX_TARGET_LENGTH);
  });

  it("leaves a normal tool name alone", () => {
    expect(normalizeTarget("Claude Code")).toBe("Claude Code");
  });
});

describe("TARGET_TOOLS", () => {
  it("offers the build tools the product positions itself around", () => {
    expect(TARGET_TOOLS).toContain("Lovable");
    expect(TARGET_TOOLS).toContain("Cursor");
    expect(TARGET_TOOLS).toContain("Claude Code");
  });

  it("every offered tool passes the request contract", () => {
    for (const tool of TARGET_TOOLS) {
      const parsed = chatRequestSchema.safeParse({
        mode: "general",
        target: tool,
        messages: [{ role: "user", content: "Baue mir eine Todo-App" }],
      });
      expect(parsed.success, `${tool} muss durch das Schema passen`).toBe(true);
    }
  });

  it("a normalized custom entry passes too, so free text is genuinely usable", () => {
    const parsed = chatRequestSchema.safeParse({
      mode: "general",
      target: normalizeTarget("  irgendein neues Tool  "),
      messages: [{ role: "user", content: "Baue mir eine Todo-App" }],
    });
    expect(parsed.success).toBe(true);
  });
});
