import { afterEach, describe, expect, it, vi } from "vitest";
import { slugify, relativeTime, formatDate } from "@/lib/utils";

describe("slugify", () => {
  it("lowercases and hyphenates words", () => {
    expect(slugify("Hello World")).toBe("hello-world");
  });

  it("trims surrounding whitespace and drops punctuation", () => {
    expect(slugify("  Mein Projekt!  ")).toBe("mein-projekt");
  });

  it("collapses repeated spaces and hyphens into one", () => {
    expect(slugify("Foo   ---   Bar")).toBe("foo-bar");
  });

  it("strips accented characters (no transliteration)", () => {
    expect(slugify("Café crème")).toBe("caf-crme");
  });

  it("returns an empty string when nothing survives", () => {
    expect(slugify("!!!")).toBe("");
    expect(slugify("---")).toBe("");
    expect(slugify("")).toBe("");
  });
});

describe("relativeTime", () => {
  afterEach(() => vi.useRealTimers());

  function freezeAt(iso: string) {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(iso));
  }

  it('returns "gerade eben" under a minute', () => {
    freezeAt("2026-06-07T12:00:00Z");
    expect(relativeTime("2026-06-07T11:59:30Z")).toBe("gerade eben");
  });

  it("reports minutes", () => {
    freezeAt("2026-06-07T12:00:00Z");
    expect(relativeTime("2026-06-07T11:55:00Z")).toBe("vor 5 Min.");
  });

  it("reports hours", () => {
    freezeAt("2026-06-07T12:00:00Z");
    expect(relativeTime("2026-06-07T10:00:00Z")).toBe("vor 2 Std.");
  });

  it("uses singular Tag for exactly one day", () => {
    freezeAt("2026-06-07T12:00:00Z");
    expect(relativeTime("2026-06-06T12:00:00Z")).toBe("vor 1 Tag");
  });

  it("uses plural Tagen for multiple days", () => {
    freezeAt("2026-06-07T12:00:00Z");
    expect(relativeTime("2026-06-04T12:00:00Z")).toBe("vor 3 Tagen");
  });

  it("falls back to a formatted date beyond a week", () => {
    freezeAt("2026-06-07T12:00:00Z");
    const old = "2026-01-01T12:00:00Z";
    expect(relativeTime(old)).toBe(formatDate(old));
  });
});
