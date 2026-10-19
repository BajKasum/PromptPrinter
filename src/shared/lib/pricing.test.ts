import { describe, expect, it } from "vitest";
import { de } from "@/shared/i18n/messages/de";
import { en } from "@/shared/i18n/messages/en";
import { fr } from "@/shared/i18n/messages/fr";
import { it as itMessages } from "@/shared/i18n/messages/it";
import { es } from "@/shared/i18n/messages/es";
import type { Locale } from "@/shared/i18n/locales";
import type { Messages } from "@/shared/i18n/messages/de";
import { PRO_AVAILABLE, PRO_UNAVAILABLE_PATH } from "@/shared/lib/pro-availability";
import { PLANS, PRO_PRICE_LABEL, buildPlans, localizePlans } from "@/shared/lib/pricing";

// Pro ist nicht kaufbar (pro-availability.ts). Solange das so ist, darf keine Karte, die Pro zeigt, einen Preis,
// eine Empfehlung, einen Kaufknopf oder eine Erstattungszusage tragen (#125). Dieselbe Datei hält fest, dass der
// Schalter in der anderen Richtung alles zurückbringt, damit die Wiederaufnahme nichts Vergessenes findet.

const BUY_WORDS = /Pro holen|Empfehlung|Geld zurück|money back|remboursé|rimborso|devoluci/i;
const MONEY = /[0-9]|€|\$/;

const proOf = (plans: ReturnType<typeof buildPlans>) => plans.find((p) => p.name === "Pro")!;

const catalogs: [Locale, Messages][] = [
  ["de", de],
  ["en", en],
  ["fr", fr],
  ["it", itMessages],
  ["es", es],
];

describe("Pro-Karte der Preisseite", () => {
  it("folgt dem Schalter: PLANS ist genau das, was buildPlans für den Schalter liefert", () => {
    expect(PLANS).toEqual(buildPlans(PRO_AVAILABLE));
  });

  it("ohne Schalter: kein Preis, keine Empfehlung, kein Checkout, keine Erstattungszusage", () => {
    const pro = proOf(buildPlans(false));
    expect(pro.soon).toBe(true);
    expect(pro.checkout).toBeFalsy();
    expect(pro.highlight).toBe(false);
    expect(pro.note).toBeUndefined();
    expect(pro.href).toBe(PRO_UNAVAILABLE_PATH);
    for (const text of [pro.price, pro.cadence, pro.cta, pro.description, pro.badge ?? ""]) {
      expect(text).not.toMatch(BUY_WORDS);
    }
    expect(pro.price).not.toMatch(MONEY);
  });

  it("mit Schalter: Preis, Empfehlung, Checkout und Erstattung sind wieder da", () => {
    const pro = proOf(buildPlans(true));
    expect(pro.soon).toBeFalsy();
    expect(pro.checkout).toBe(true);
    expect(pro.highlight).toBe(true);
    expect(pro.price).toBe(PRO_PRICE_LABEL);
    expect(pro.cta).toBe("Pro holen");
    expect(pro.note).toMatch(/Geld zurück/);
  });

  it("Free bleibt in beiden Zuständen gleich", () => {
    const free = (plans: ReturnType<typeof buildPlans>) => plans.find((p) => p.name === "Free");
    expect(free(buildPlans(false))).toEqual(free(buildPlans(true)));
  });
});

describe("Pro-Karte in der App (/plans, /billing)", () => {
  it.each(catalogs)("%s: ohne Schalter kein Preis, keine Empfehlung, keine Erstattungszusage", (locale, t) => {
    const pro = proOf(localizePlans(t, locale, false));
    expect(pro.soon).toBe(true);
    expect(pro.price).toBe(t.planCopy.proSoon.price);
    expect(pro.price).not.toMatch(MONEY);
    expect(pro.cadence).toBe("");
    expect(pro.note).toBeUndefined();
    expect(pro.highlight).toBe(false);
    for (const text of [pro.price, pro.cta, pro.description, pro.badge ?? ""]) {
      expect(text).not.toMatch(BUY_WORDS);
    }
    expect(pro.features.length).toBeGreaterThan(0);
  });

  it.each(catalogs)("%s: mit Schalter bleibt der echte Plan mit Preis und Erstattung", (locale, t) => {
    const pro = proOf(localizePlans(t, locale, true));
    expect(pro.soon).toBeFalsy();
    expect(pro.price).toMatch(MONEY);
    expect(pro.note).toBe(t.planCopy.pro.note);
    expect(pro.highlight).toBe(true);
  });

  it.each(catalogs)("%s: die Ersatztexte stehen in allen fünf Sprachen", (_locale, t) => {
    for (const text of [
      t.chat.keyNoticeBodySoon,
      t.pages.billing.upsellTitleSoon,
      t.pages.usage.noteFreeSoon,
      t.pages.plans.subtitleSoon,
      t.api.byokRequiredSoon,
      t.planCopy.proSoon.description,
      t.planCopy.proSoon.badge,
      t.planCopy.proSoon.cta,
    ]) {
      expect(text.trim().length).toBeGreaterThan(10);
      expect(text).not.toMatch(/\bPro (holen|get)/i);
    }
    // Die Fassung ohne Pro nennt Pro nicht als Weg: weder "wechsle zu Pro" noch "mit Pro übernehme ich".
    expect(t.chat.keyNoticeBodySoon).not.toMatch(/\bPro\b/);
    expect(t.api.byokRequiredSoon).not.toMatch(/\bPro\b/);
    expect(t.pages.usage.noteFreeSoon).not.toMatch(/\bPro\b/);
  });
});
