import { afterEach, describe, expect, it, vi } from "vitest";
import { formatDate, randomId, relativeTime, slugify } from "@/lib/utils";

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

// QA finding K-4: crypto.randomUUID() requires a Secure Context and is
// undefined over plain http on a LAN IP — the standard way to test on a real
// phone during dev. project-files.tsx inserts the result into a uuid primary
// key column, so the fallback has to produce a real UUID shape, not just any
// unique string.
describe("randomId", () => {
  const UUID_V4 = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  const originalRandomUUID = crypto.randomUUID;

  // Deleting the method (rather than spreading `crypto` into a plain object,
  // which loses getRandomValues too — it lives on the prototype, not as an
  // own property) is what actually reproduces the unsupported-browser shape:
  // getRandomValues has no Secure Context restriction and must keep working,
  // only randomUUID is unavailable.
  function withoutRandomUUID() {
    Object.defineProperty(crypto, "randomUUID", { value: undefined, configurable: true });
  }
  afterEach(() => {
    Object.defineProperty(crypto, "randomUUID", { value: originalRandomUUID, configurable: true });
  });

  it("uses crypto.randomUUID() when available", () => {
    const spy = vi
      .spyOn(crypto, "randomUUID")
      .mockReturnValue("11111111-1111-4111-8111-111111111111");
    expect(randomId()).toBe("11111111-1111-4111-8111-111111111111");
    expect(spy).toHaveBeenCalled();
  });

  it("falls back to a real v4 UUID built from getRandomValues when randomUUID is unavailable", () => {
    withoutRandomUUID();
    expect(randomId()).toMatch(UUID_V4);
  });

  it("never repeats across calls in the fallback path", () => {
    withoutRandomUUID();
    const ids = new Set(Array.from({ length: 50 }, () => randomId()));
    expect(ids.size).toBe(50);
  });
});
