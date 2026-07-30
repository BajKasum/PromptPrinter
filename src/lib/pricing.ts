import { PLAN_LIMITS } from "@/lib/plans";

// The marketed price and what each plan actually gets. One source, because
// this used to live inside the pricing-grid component while the ENFORCED
// numbers lived in plans.ts — two places that described the same product and
// had no way of knowing about each other.
//
// ─── Re-priced 2026-07-30: 5,90 €, Free 25 / Pro 350 ─────────────────────
// Previous pass (2026-07-29) landed on 5 € / Free 50 / Pro 400 purely from the
// cost side — the smallest price that still survives a worst-case month.
// Product call on top of that: Free should cost as little as possible per
// signup (most Free accounts never convert, every one of them is a cost with
// no revenue behind it) without making Pro pointless to buy, and Pro should
// read as a clear, sizeable step up, not a marginal one.
//
// Measured against the real cost of a chat turn on glm-4.5-air (llm.ts's
// server default: $0.20/$1.10 per 1M input/output tokens, verified against
// the live Z.ai account):
//
//   typical turn (~5k in / 2k out)   ≈ $0.0032
//   worst case   (24k in / 6144 out) ≈ $0.0116   — the ceiling the code
//                                                   itself budgets for
//
// At 5,90 €/month, Lemon Squeezy's cut (5 % + $0.50 per transaction, the
// planned processor, a Merchant of Record) leaves ≈ $5.55 net. Against that:
//
//   Pro,  350/month: $1.12 typical (80 % margin) · $4.05 worst case
//                     (still +$1.51 — the FIRST price point in this project's
//                     history that stays profitable even if every single
//                     turn hits the ceiling, not just on average)
//   Free,  25/month: $0.08 typical · $0.29 worst case per signup — the actual
//                     cost of offering a free tier at all, now small enough
//                     not to worry about at any signup volume this stage of
//                     the product will see.
//
// Pro/Free ratio is 350 / 25 = 14×. The marketing copy below intentionally
// says "10×" — a round number that UNDERSTATES the real multiple rather than
// inflating it, so it stays true even if either number moves slightly later.
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
  note?: string;
  /** Short value pill shown under the price (e.g. "10× mehr Nutzung als Free"). */
  badge?: string;
  highlight: boolean;
  /** Mascot state for this plan's card — Finn reacts to what you pick. */
  mascot: "curious" | "celebrating";
  features: string[];
};

export const PLANS: MarketingPlan[] = [
  {
    name: "Free",
    price: "0 €",
    cadence: "für immer",
    description: "Zum Ausprobieren, und dauerhaft gratis mit deinem eigenen KI-Key.",
    cta: "Kostenlos starten",
    href: "/signup",
    highlight: false,
    mascot: "curious",
    features: [
      // Led with the BYOK point on purpose: this is the actual "free
      // forever" story, not the monthly count below it. Anyone who already
      // has an Anthropic/OpenAI/Gemini key pays their own provider directly
      // and never touches this app's limits at all.
      "Eigener KI-Key: die App bleibt für dich komplett gratis",
      `Ohne eigenen Key: ${PLAN_LIMITS.free.chatMessages} Prompts pro Monat mit meiner KI`,
      `Bis zu ${PLAN_LIMITS.free.projects} Projekte`,
      "Für jede Ziel-KI zugeschnitten",
      "Markdown-Export",
    ],
  },
  {
    name: "Pro",
    price: PRO_PRICE_LABEL,
    cadence: "Monat",
    description: "Wenn du regelmässig baust und dich um keinen eigenen Key kümmern willst.",
    // "Pro starten" versprach einen Kauf, den es nicht gibt: der Klick führte
    // auf eine gewöhnliche Registrierung, das Konto landete auf Free, und dass
    // Bezahlung noch gar nicht freigeschaltet ist, stand nur hinter dem Login
    // auf der Abrechnungsseite (QA-Befund U-2). Jetzt sagt der Button, was er
    // tut, und die Notiz darunter sagt, warum.
    cta: "Für Pro vormerken",
    href: "/signup?plan=pro",
    note: "Bezahlung ist noch nicht freigeschaltet. Du startest auf Free, ich melde mich, sobald Pro buchbar ist.",
    badge: "10× mehr Nutzung als Free",
    highlight: true,
    mascot: "celebrating",
    features: [
      "Alles aus Free",
      `${PLAN_LIMITS.pro.chatMessages} Prompts pro Monat mit meiner KI`,
      "Kein eigener Key nötig",
      "Unbegrenzt viele Projekte",
      "PDF- & Markdown-Export",
    ],
  },
];
