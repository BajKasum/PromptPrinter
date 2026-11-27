import { afterEach, describe, expect, it, vi } from "vitest";
import { formatBytes, formatDate, randomId, relativeTime } from "@/shared/lib/utils";
import { LOCALE_TAGS } from "@/shared/i18n/locales";

describe("formatBytes", () => {
  describe.each(["de", "en"] as const)("in der Sprache %s", (locale) => {
    const tag = LOCALE_TAGS[locale].intl;

    it.each([
      [25 * 1024 * 1024, "25 MB"],
      [2 * 1024 * 1024, "2 MB"],
      [900, "900 B"],
    ])("zeigt %i Byte als %s", (bytes, text) => {
      expect(formatBytes(bytes, tag)).toBe(text);
    });
  });

  it("wechselt bei 1024 die Einheit", () => {
    expect(formatBytes(1023, "en-GB")).toBe("1023 B");
    expect(formatBytes(1024, "en-GB")).toBe("1 KB");
    expect(formatBytes(200 * 1024, "en-GB")).toBe("200 KB");
    expect(formatBytes(1024 * 1024, "en-GB")).toBe("1 MB");
  });

  // Unter 10 MB mit einer Nachkommastelle, ab 10 MB ohne; das Zeichen gehört zur Sprache.
  it.each([
    ["de-CH", "1.5 MB"],
    ["en-GB", "1.5 MB"],
    ["fr-FR", "1,5 MB"],
    ["it-IT", "1,5 MB"],
    ["es-ES", "1,5 MB"],
  ])("setzt in %s das Dezimalzeichen der Sprache", (tag, text) => {
    expect(formatBytes(1.5 * 1024 * 1024, tag)).toBe(text);
    expect(formatBytes(12.4 * 1024 * 1024, tag)).toBe("12 MB");
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
