import { PLAN_LIMITS } from "@/lib/plans";

// The marketed price and what each plan actually gets. One source, because
// this used to live inside the pricing-grid component while the ENFORCED numbers
// lived in plans.ts — two places that described the same product and had no
// way of knowing about each other.
//
// ─── Why 5 €, and why 400 prompts ────────────────────────────────────────
// Measured against the real cost of a chat turn on glm-4.5-air (llm.ts's
// server default: $0.20/$1.10 per 1M input/output tokens, verified against
// the live Z.ai account):
//
//   typical turn (~5k in / 2k out)  ≈ $0.0032
//   worst case   (24k in / 6144 out) ≈ $0.0116   — the ceiling the code
//                                                  itself budgets for
//
// The previous plan was 7 € for 2000 prompts/month. That is 4 % margin at
// typical usage and a **$16 loss per user** at the worst case — the price was
// never the problem, the limit was. 400 prompts/month at 5 € is the one
// combination that still turns a profit at typical usage (~72 %) and does not
// lose money even if every single turn hits the worst-case ceiling.
//
// Lemon Squeezy (the planned processor, Merchant of Record) takes 5 % + $0.50
// per transaction, so the fixed part alone is 20 % of revenue at 3 € but only
// 14 % at 5 € — going lower costs more than it looks.
//
// 400/month is also generous in practice: 13 finished prompts a day, for a
// tool you use before you start building, not while you build.
export const PRO_PRICE_EUR = 5;

export type MarketingPlan = {
  name: string;
  price: string;
  cadence: string;
  description: string;
  cta: string;
  href: string;
  note?: string;
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
      `${PLAN_LIMITS.free.chatMessages} Prompts pro Monat mit meiner KI`,
      "Mit eigenem KI-Key: unbegrenzt",
      `Bis zu ${PLAN_LIMITS.free.projects} Projekte`,
      "Für jede Ziel-KI zugeschnitten",
      "Markdown-Export",
    ],
  },
  {
    name: "Pro",
    price: `${PRO_PRICE_EUR} €`,
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
