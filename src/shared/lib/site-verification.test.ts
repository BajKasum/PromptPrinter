import { describe, expect, it } from "vitest";
import { siteVerification } from "./site-verification";

describe("siteVerification", () => {
  it("setzt ohne Variablen kein Tag", () => {
    expect(siteVerification({})).toBeUndefined();
  });

  // Vercel legt eine leer gespeicherte Variable als "" an. Ein Meta-Tag mit
  // leerem content wäre ein Nachweis für niemanden.
  it("behandelt leere und nur aus Leerzeichen bestehende Werte wie nicht gesetzt", () => {
    expect(
      siteVerification({ GOOGLE_SITE_VERIFICATION: "", BING_SITE_VERIFICATION: "   " })
    ).toBeUndefined();
  });

  it("reicht den Google-Wert durch", () => {
    expect(siteVerification({ GOOGLE_SITE_VERIFICATION: " abc123 " })).toEqual({
      google: "abc123",
    });
  });

  it("legt den Bing-Wert unter dem Namen ab, den Bing erwartet", () => {
    expect(siteVerification({ BING_SITE_VERIFICATION: "F00" })).toEqual({
      other: { "msvalidate.01": "F00" },
    });
  });

  it("setzt beide, wenn beide vorhanden sind", () => {
    expect(
      siteVerification({ GOOGLE_SITE_VERIFICATION: "abc123", BING_SITE_VERIFICATION: "F00" })
    ).toEqual({ google: "abc123", other: { "msvalidate.01": "F00" } });
  });
});
