import { describe, expect, it } from "vitest";
import { isValidElement } from "react";
import { fmt, plural, rich } from "./format";

describe("fmt", () => {
  it("fills placeholders", () => {
    expect(fmt("Hallo {name}, du hast {count} Chats", { name: "Finn", count: 3 })).toBe(
      "Hallo Finn, du hast 3 Chats"
    );
  });

  it("leaves unknown placeholders visible instead of dropping them", () => {
    expect(fmt("Hallo {name}", {})).toBe("Hallo {name}");
  });
});

describe("plural", () => {
  const chats = { one: "{count} Chat", other: "{count} Chats" };

  it("picks one/other by the language's own rules", () => {
    expect(plural(chats, 1, "de")).toBe("1 Chat");
    expect(plural(chats, 0, "de")).toBe("0 Chats");
    expect(plural(chats, 2, "de")).toBe("2 Chats");
  });

  it("passes extra variables through", () => {
    expect(plural({ one: "{count} von {total}", other: "{count} von {total}" }, 2, "de", { total: 5 })).toBe(
      "2 von 5"
    );
  });
});

describe("rich", () => {
  it("keeps the sentence in order and swaps placeholders for nodes", () => {
    const parts = rich("„{title}“ löschen?", { title: "Alpha" });
    expect(parts.map((p) => (isValidElement(p) ? (p.props as { children: unknown }).children : p))).toEqual([
      "„",
      "Alpha",
      "“ löschen?",
    ]);
  });
});
