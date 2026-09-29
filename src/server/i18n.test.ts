import { describe, expect, it, vi } from "vitest";

vi.mock("@/server/session", () => ({ getSessionProfile: vi.fn(async () => null) }));
vi.mock("next/headers", () => ({ cookies: vi.fn() }));

import { localeFromSettings, messagesFor, requestT } from "./i18n";
import { de } from "@/shared/i18n/messages/de";

function req(cookie?: string) {
  return new Request("http://localhost/api/chat", {
    method: "POST",
    headers: cookie ? { cookie } : {},
  });
}

describe("requestT", () => {
  it("falls back to German without a cookie", () => {
    expect(requestT(req()).locale).toBe("de");
    expect(requestT(req()).t).toBe(de);
  });

  it("reads pp-locale among other cookies", () => {
    expect(requestT(req("sb-token=abc; pp-locale=de; pp-sidebar=1")).locale).toBe("de");
  });

  it("ignores unknown values and look-alike cookie names", () => {
    expect(requestT(req("pp-locale=xx")).locale).toBe("de");
    expect(requestT(req("xpp-locale=de")).locale).toBe("de");
  });
});

describe("localeFromSettings", () => {
  it("reads a stored locale from profiles.settings", () => {
    expect(localeFromSettings({ locale: "de", interested_in: "pro" })).toBe("de");
  });

  it("ignores anything that isn't a known locale on a plain object", () => {
    expect(localeFromSettings(null)).toBeNull();
    expect(localeFromSettings([])).toBeNull();
    expect(localeFromSettings({ locale: "klingon" })).toBeNull();
  });
});

describe("messagesFor", () => {
  it("serves the German dictionary for de", () => {
    expect(messagesFor("de")).toBe(de);
  });
});
