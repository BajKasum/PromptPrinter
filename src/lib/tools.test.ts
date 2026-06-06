import { describe, expect, it } from "vitest";
import { parseToolDefaults, toolsSchema, DEFAULT_TOOLS } from "@/lib/tools";

describe("parseToolDefaults", () => {
  it("returns the defaults for undefined, null or non-object input", () => {
    expect(parseToolDefaults(undefined)).toEqual(DEFAULT_TOOLS);
    expect(parseToolDefaults(null)).toEqual(DEFAULT_TOOLS);
    expect(parseToolDefaults("nope")).toEqual(DEFAULT_TOOLS);
  });

  it("reads stored defaults out of settings.defaultTools", () => {
    const tools = parseToolDefaults({ defaultTools: { master: "Deepseek" } });
    expect(tools.master).toBe("Deepseek");
    // Fields that aren't stored keep their defaults.
    expect(tools.frontend).toBe(DEFAULT_TOOLS.frontend);
  });

  it("falls back per-field for blank or oversized values", () => {
    const tools = parseToolDefaults({
      defaultTools: { master: "   ", frontend: "x".repeat(60) },
    });
    expect(tools.master).toBe(DEFAULT_TOOLS.master);
    expect(tools.frontend).toBe(DEFAULT_TOOLS.frontend);
  });

  it("trims valid custom values", () => {
    const tools = parseToolDefaults({ defaultTools: { database: "  NoSQL  " } });
    expect(tools.database).toBe("NoSQL");
  });
});

describe("toolsSchema", () => {
  it("accepts a complete set and trims the values", () => {
    const parsed = toolsSchema.parse({
      master: "  Claude  ",
      frontend: "Lovable",
      backend: "Cursor",
      database: "Supabase",
    });
    expect(parsed.master).toBe("Claude");
  });

  it("rejects a missing field", () => {
    expect(toolsSchema.safeParse({ master: "Claude" }).success).toBe(false);
  });

  it("rejects a blank field", () => {
    const result = toolsSchema.safeParse({
      master: "",
      frontend: "Lovable",
      backend: "Cursor",
      database: "Supabase",
    });
    expect(result.success).toBe(false);
  });
});
