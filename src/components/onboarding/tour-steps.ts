import type { MascotState } from "@/components/brand/mascot-states";

export type TourStep = {
  id: string;
  /**
   * CSS selectors tried in order — the first visible match becomes the
   * spotlight target. Steps without selectors render as a centered card.
   * Steps whose selectors all miss (e.g. the desktop sidebar on a phone)
   * are dropped when the tour starts.
   */
  selectors?: string[];
  /** Which Finn shows up for this step — the tour's throughline (Tour.tsx
   * renders this beside the title on every step, so he's never just a logo). */
  mascot: MascotState;
  title: string;
  body: string;
};

// The first-login tour, in walk-through order. Every target is a real,
// always-rendered piece of the app chrome (sidebar, topbar) so the whole tour
// runs on one page — it auto-starts on /chats, the login landing. Copy is in
// Finn's own voice throughout (CLAUDE.md's brand rule extends here too, not
// just marketing): he's the one leading you through, not a neutral narrator.
export const TOUR_STEPS: TourStep[] = [
  {
    id: "welcome",
    mascot: "welcoming",
    title: "Schön, dass du da bist",
    body: "Ich bin Finn. Ich zeig dir kurz, wie wir hier arbeiten — aus deinen Ideen mach ich fertige Prompts, Schritt für Schritt. Dauert keine Minute.",
  },
  {
    id: "new-chat",
    selectors: ['[data-tour="new-chat"]'],
    mascot: "curious",
    title: "Hier fängt's an",
    body: "Über „Neuer Chat“ erzählst du mir, woran du arbeitest — ein Text, eine App-Idee, was auch immer. Ich hör zu, frag nach, und wir bauen den Prompt zusammen.",
  },
  {
    id: "nav",
    selectors: ['[data-tour="nav-main"]'],
    mascot: "explaining",
    title: "Deine zwei Arbeitsorte",
    body: "Chats sind für den schnellen, ruhigen Austausch mit mir — die letzten stehen direkt hier. Mit der Pille oben schaltest du auf deine Projekte um: da heben wir uns ein gutes Ergebnis auf, mit einem eigenen Arbeitsraum dafür.",
  },
  {
    id: "project-context",
    mascot: "organizing",
    title: "Was ich mir für dich merke",
    body: "In einem Projekt kenne ich deine Anweisungen, deine Struktur und jede Datei, die du mir gibst — und finde jedes Ergebnis wieder. Du musst mir nichts zweimal erzählen.",
  },
  {
    id: "mobile-menu",
    // Only visible below md — desktop drops this step automatically.
    selectors: ['[data-tour="mobile-menu"]'],
    mascot: "helping",
    title: "Alles griffbereit",
    body: "Hier dahinter findest du alles: neuen Chat starten, deine Chats, Projekte und Einstellungen.",
  },
  {
    id: "search",
    selectors: ['[data-tour="search"]'],
    mascot: "researching",
    title: "Schneller ans Ziel",
    body: "Strg + K (⌘K am Mac), und ich bring dich sofort zu jeder Seite oder jedem Projekt — ganz ohne zu klicken.",
  },
  {
    id: "account",
    selectors: ['[data-tour="topbar-actions"]'],
    mascot: "helping",
    title: "Dein Konto",
    body: "Hier siehst du Benachrichtigungen und erreichst dein Konto — Einstellungen, Abrechnung, Logout.",
  },
  {
    id: "done",
    mascot: "celebrating",
    title: "Los geht's",
    body: "Du bist startklar. Leg direkt los — oder hol mich über „Hilfe & Onboarding“ in den Einstellungen für diese Tour zurück.",
  },
];
