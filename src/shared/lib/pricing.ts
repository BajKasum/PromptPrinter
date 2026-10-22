import { PLAN_LIMITS } from "@/shared/lib/plans";
import { fmt } from "@/shared/i18n/format";
import { LOCALE_TAGS, type Locale } from "@/shared/i18n/locales";
import type { Messages } from "@/shared/i18n/messages/de";
import { PRO_AVAILABLE, PRO_UNAVAILABLE_PATH } from "@/shared/lib/pro-availability";

// The marketed price and what each plan actually gets. One source, because
// this used to live inside the pricing-grid component while the ENFORCED
// numbers lived in plans.ts — two places that described the same product and
// had no way of knowing about each other.
//
// ─── Re-modelled 2026-07-30: Free is BYOK-only ───────────────────────────
// This is a structural change, not another round of tuning the same numbers.
// A solo, self-funded operator can't carry a per-signup cost on the server's
// own key at all, however small — every earlier pass (7 €/2000, then 5 €/400,
// then 5,90 €/350) still charged the operator something for every Free
// account, just less of it each time. This pass removes that cost entirely
// instead of shrinking it further: Free no longer has ANY allowance on the
// server's key (plans.ts: `chatMessages: 0`) — chatting on Free requires a
// BYOK key (Anthropic/OpenAI/Gemini/custom), full stop. With one, Free is
// genuinely unlimited, because the user's own provider account is footing the
// bill, not this app's. Without one, /api/chat's dedicated early-return
// refuses with a message that says so, before ever touching the quota
// machinery (see that route's own comment).
//
// So the marketed copy below leads with the key requirement, not a message
// count — advertising "0 prompts/month" would be actively misleading (reads
// like a broken free tier, not the intentional BYOK gate it is).
//
// Pro stays the only way to use the app WITHOUT a key of your own, moves
// 350 → 400 (see plans.ts: with Free now free of server-key cost, there's no
// downward cost pressure on Pro's own allowance). At 5,90 €/month, after
// Lemon Squeezy's cut (5 % + $0.50, the planned Merchant of Record) that's
// ≈ $5.55 net; against glm-4.5-air's real per-turn cost (llm.ts, verified live
// against the Z.ai account: $0.20/$1.10 per 1M in/out tokens):
//
//   400 × typical turn (~5k in/2k out, ≈$0.0032)    = $1.28  → 77 % margin
//   400 × worst case   (24k in/6144 out, ≈$0.0116)  = $4.64  → still +$0.91
//
// Comfortably profitable even in the code's own worst-case scenario, and the
// operator's total server-key exposure is now bounded to Pro/Team accounts
// only — Free structurally cannot spend it, at any signup volume.
export const PRO_PRICE_EUR = 5.9;

/** German price formatting: comma decimal, two places, trailing €. */
function formatEuroPrice(amount: number): string {
  return `${amount.toFixed(2).replace(".", ",")} €`;
}

export const PRO_PRICE_LABEL = formatEuroPrice(PRO_PRICE_EUR);

export type MarketingPlan = {
  name: string;
  price: string;
  cadence: string;
  description: string;
  cta: string;
  href: string;
  /**
   * Öffnet der Aufruf zur Handlung den Lemon-Squeezy-Checkout statt zu
   * navigieren?
   *
   * `href` bleibt daneben bestehen und ist kein toter Rest: es ist das Ziel,
   * wenn kein Checkout konfiguriert ist (siehe LemonCheckoutButton's
   * `fallbackHref`), und damit der Grund, warum eine Vorschau-Deployment ohne
   * Zahlungsanbieter trotzdem eine vollständige Preisseite zeigt.
   */
  checkout?: boolean;
  note?: string;
  /** Short value pill shown under the price (e.g. "Kein eigener Key nötig"). */
  badge?: string;
  highlight: boolean;
  /**
   * Der Plan ist gerade nicht buchbar (pro-availability.ts). Dann trägt die Karte weder Preis noch
   * Empfehlung noch Kaufknopf noch Erstattungstext, `cta` führt auf die Erklärung statt in den Checkout.
   */
  soon?: boolean;
  /** Mascot state for this plan's card — Finn reacts to what you pick. */
  mascot: "curious" | "celebrating";
  features: string[];
};

const FREE_PLAN: MarketingPlan = {
  name: "Free",
  price: "0 €",
  cadence: "für immer",
  description: "Bring deinen eigenen KI-Key mit, dann ist die App komplett gratis für dich.",
  cta: "Kostenlos starten",
  href: "/signup",
  highlight: false,
  mascot: "curious",
  features: [
    // Led with the requirement, not framed as an optional perk: this is
    // what makes Free free. Without a key, Free can't chat at all — see
    // this file's own top comment for why.
    "Eigener KI-Key nötig (Anthropic, OpenAI, Gemini oder ein anderer Anbieter)",
    // "ohne Monatslimit" statt "unbegrenzt": auch mit eigenem Key greift
    // der stuendliche Missbrauchsschutz (AGB Ziffer 8). "Unbegrenzt" war
    // damit eine Zusage, die der Code nicht haelt (Rechts-Audit 28.09.2026).
    "Mit deinem Key: ohne Monatslimit, die App selbst bleibt gratis",
    `Bis zu ${PLAN_LIMITS.free.projects} Projekte`,
    "Prompts für jede KI und jede Aufgabe",
    "Markdown-Export",
  ],
};

const PRO_FEATURES = [
  "Alles aus Free",
  // Gezaehlt werden Chat-Antworten (plans.ts), nicht fertige Prompts: ein
  // Prompt braucht mindestens zwei Antworten (Rueckfrage, dann Prompt).
  // "400 Prompts" versprach damit rund das Doppelte dessen, was das
  // Kontingent hergibt, und widersprach /docs/plaene-und-limits, das
  // schon "Chat-Antworten" sagt (Rechts-Audit 28.09.2026).
  `${PLAN_LIMITS.pro.chatMessages} Chat-Antworten pro Monat mit meiner KI`,
  "Kein eigener Key nötig",
  "Unbegrenzt viele Projekte",
  "PDF- & Markdown-Export",
];

const PRO_PLAN: MarketingPlan = {
  name: "Pro",
  price: PRO_PRICE_LABEL,
  cadence: "Monat",
  description: "Wenn du keinen eigenen Key einrichten willst, übernehme ich das für dich.",
  // Der Knopf führt seit dem 04.08.2026 in den Checkout (Lemon Squeezy),
  // nicht mehr auf eine Warteliste. Davor stand hier "Für Pro vormerken"
  // samt Notiz, dass Bezahlung nicht freigeschaltet ist — die Fassung, mit
  // der QA-Befund U-2 den Widerspruch "Knopf verspricht einen Kauf, den es
  // nicht gibt" ehrlich stillgelegt hatte, bis es den Kauf wirklich gibt.
  //
  // `href` bleibt der Weg für den Fall, dass kein Checkout konfiguriert ist
  // (siehe `checkout` oben): dann ist Registrieren immer noch das Richtige.
  cta: "Pro holen",
  href: "/signup?plan=pro",
  checkout: true,
  note: "Monatlich kündbar. Auf die erste Zahlung gibt es 14 Tage Geld zurück, ohne Begründung.",
  badge: "Kein eigener Key nötig",
  highlight: true,
  mascot: "celebrating",
  features: PRO_FEATURES,
};

// Solange Pro nicht buchbar ist (pro-availability.ts), sagt jede Stelle, die Pro nennt, das schon
// vorher: kein Preis, keine Empfehlung, kein Kaufknopf, kein Erstattungstext. Die Karte bleibt als
// Vorschau stehen und führt auf die Erklärung. Ein bestehender Pro-Nutzer sieht weiter den echten
// Plan (localizePlans mit proAvailable = true).
const PRO_PLAN_SOON: MarketingPlan = {
  name: "Pro",
  price: "Später",
  cadence: "",
  description:
    "Wenn du keinen eigenen Key einrichten willst, übernehme ich das irgendwann für dich. Buchen kann man Pro im Moment nicht.",
  cta: "Warum noch nicht?",
  href: PRO_UNAVAILABLE_PATH,
  badge: "Noch nicht verfügbar",
  highlight: false,
  soon: true,
  mascot: "curious",
  features: PRO_FEATURES,
};

/** Die Pläne, wie sie jetzt angeboten werden. `proAvailable` ist in Tests umschaltbar. */
export function buildPlans(proAvailable: boolean): MarketingPlan[] {
  return [FREE_PLAN, proAvailable ? PRO_PLAN : PRO_PLAN_SOON];
}

export const PLANS: MarketingPlan[] = buildPlans(PRO_AVAILABLE);

/**
 * Preis als Text in der Sprache der App. Deutsch wie auf der Preisseite
 * ("5,90 €"), sonst nach den Regeln der jeweiligen Sprache ("€5.90").
 * de-CH bewusst nicht: Intl schreibt dort "€ 5.90", die Preisseite aber
 * "5,90 €", und beides nebeneinander sähe nach zwei Preisen aus.
 */
const PRICE_TAG_OVERRIDE: Partial<Record<Locale, string>> = { de: "de-DE" };

export function formatPlanPrice(amount: number, locale: Locale): string {
  const tag = PRICE_TAG_OVERRIDE[locale] ?? LOCALE_TAGS[locale].intl;
  return new Intl.NumberFormat(tag, {
    style: "currency",
    currency: "EUR",
    minimumFractionDigits: Number.isInteger(amount) ? 0 : 2,
    maximumFractionDigits: 2,
  }).format(amount);
}

/**
 * PLANS in der Sprache der App (/plans, /billing). Struktur, Links und
 * Checkout bleiben die aus PLANS, nur die Texte kommen aus dem Wörterbuch
 * (t.planCopy), die Zahlen darin setzt diese Funktion aus PLAN_LIMITS ein.
 * Die öffentliche Preisseite bleibt Deutsch und liest PLANS direkt.
 */
export function localizePlans(
  t: Messages,
  locale: Locale,
  proAvailable: boolean = PRO_AVAILABLE
): MarketingPlan[] {
  const vars = {
    projects: PLAN_LIMITS.free.projects,
    chatMessages: PLAN_LIMITS.pro.chatMessages,
  };
  return buildPlans(proAvailable).map((plan) => {
    const isPro = plan.name === "Pro";
    const copy = isPro ? t.planCopy.pro : t.planCopy.free;
    if (plan.soon) {
      const soon = t.planCopy.proSoon;
      return {
        ...plan,
        price: soon.price,
        description: soon.description,
        badge: soon.badge,
        cta: soon.cta,
        features: copy.features.map((f) => fmt(f, vars)),
      };
    }
    return {
      ...plan,
      price: formatPlanPrice(isPro ? PRO_PRICE_EUR : 0, locale),
      cadence: copy.cadence,
      description: copy.description,
      badge: isPro ? t.planCopy.pro.badge : plan.badge,
      note: isPro ? t.planCopy.pro.note : plan.note,
      features: copy.features.map((f) => fmt(f, vars)),
    };
  });
}
