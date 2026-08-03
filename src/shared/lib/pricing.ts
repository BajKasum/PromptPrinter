import { PLAN_LIMITS } from "@/shared/lib/plans";

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
  note?: string;
  /** Short value pill shown under the price (e.g. "Kein eigener Key nötig"). */
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
    description: "Bring deinen eigenen KI-Key mit, dann ist die App komplett gratis für dich.",
    cta: "Kostenlos starten",
    href: "/signup",
    highlight: false,
    mascot: "curious",
    features: [
      // Led with the requirement, not framed as an optional perk: this is
      // what makes Free free. Without a key, Free can't chat at all — see
      // this file's own top comment for why.
      "Eigener KI-Key nötig (Anthropic, OpenAI oder Gemini)",
      "Mit deinem Key: unbegrenzt, die App selbst bleibt gratis",
      `Bis zu ${PLAN_LIMITS.free.projects} Projekte`,
      "Für jede Ziel-KI zugeschnitten",
      "Markdown-Export",
    ],
  },
  {
    name: "Pro",
    price: PRO_PRICE_LABEL,
    cadence: "Monat",
    description: "Wenn du keinen eigenen Key einrichten willst, übernehme ich das für dich.",
    // "Pro starten" versprach einen Kauf, den es nicht gibt: der Klick führte
    // auf eine gewöhnliche Registrierung, das Konto landete auf Free, und dass
    // Bezahlung noch gar nicht freigeschaltet ist, stand nur hinter dem Login
    // auf der Abrechnungsseite (QA-Befund U-2). Jetzt sagt der Button, was er
    // tut, und die Notiz darunter sagt, warum.
    cta: "Für Pro vormerken",
    href: "/signup?plan=pro",
    note: "Bezahlung ist noch nicht freigeschaltet. Du startest auf Free, ich melde mich, sobald Pro buchbar ist.",
    badge: "Kein eigener Key nötig",
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
