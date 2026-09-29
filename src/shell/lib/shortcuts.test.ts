import { describe, expect, it } from "vitest";
import { ariaShortcut, formatShortcut, matchesShortcut } from "./shortcuts";
import { secondaryNav } from "./nav";

function key(k: string, mods: Partial<Record<"ctrl" | "meta" | "shift" | "alt", boolean>> = {}) {
  return {
    key: k,
    ctrlKey: mods.ctrl ?? false,
    metaKey: mods.meta ?? false,
    shiftKey: mods.shift ?? false,
    altKey: mods.alt ?? false,
  };
}

describe("matchesShortcut", () => {
  const settings = { key: ",", shift: false };
  const usage = { key: "u", shift: true };

  it("matches Ctrl and Cmd alike", () => {
    expect(matchesShortcut(key(",", { ctrl: true }), settings)).toBe(true);
    expect(matchesShortcut(key(",", { meta: true }), settings)).toBe(true);
  });

  it("needs a modifier", () => {
    expect(matchesShortcut(key(","), settings)).toBe(false);
  });

  it("requires shift to match exactly", () => {
    expect(matchesShortcut(key("U", { ctrl: true, shift: true }), usage)).toBe(true);
    expect(matchesShortcut(key("u", { ctrl: true }), usage)).toBe(false);
    expect(matchesShortcut(key(",", { ctrl: true, shift: true }), settings)).toBe(false);
  });

  it("ignores AltGr (Ctrl+Alt on Windows), so typing @ or € never navigates", () => {
    expect(matchesShortcut(key("u", { ctrl: true, alt: true, shift: true }), usage)).toBe(false);
  });
});

describe("formatShortcut", () => {
  it("writes out the modifier on Windows/Linux", () => {
    expect(formatShortcut({ key: ",", shift: false }, false)).toBe("Strg+,");
    expect(formatShortcut({ key: "u", shift: true }, false)).toBe("Strg+Shift+U");
    expect(formatShortcut({ key: "u", shift: true }, false, "Ctrl")).toBe("Ctrl+Shift+U");
  });

  it("uses symbols on macOS", () => {
    expect(formatShortcut({ key: ",", shift: false }, true)).toBe("⌘,");
    expect(formatShortcut({ key: "b", shift: true }, true)).toBe("⇧⌘B");
  });
});

describe("ariaShortcut", () => {
  it("lists both modifiers", () => {
    expect(ariaShortcut({ key: "s", shift: true })).toBe("Control+Shift+S Meta+Shift+S");
  });
});

describe("account menu shortcuts", () => {
  it("gives every account destination a distinct shortcut", () => {
    const all = secondaryNav.map((n) => n.shortcut);
    expect(all.every(Boolean)).toBe(true);
    const ids = all.map((s) => `${s!.shift}-${s!.key}`);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("keeps clear of the app's own Ctrl+K and Ctrl+B", () => {
    for (const n of secondaryNav) {
      const s = n.shortcut!;
      expect(matchesShortcut(key("k", { ctrl: true }), s)).toBe(false);
      expect(matchesShortcut(key("b", { ctrl: true }), s)).toBe(false);
    }
  });
});
