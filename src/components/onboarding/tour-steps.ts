export type TourStep = {
  id: string;
  /**
   * CSS selectors tried in order — the first visible match becomes the
   * spotlight target. Steps without selectors render as a centered card.
   * Steps whose selectors all miss (e.g. the desktop sidebar on a phone)
   * are dropped when the tour starts.
   */
  selectors?: string[];
  title: string;
  body: string;
};

// The first-login tour, in walk-through order. Every target is a real,
// always-rendered piece of the app chrome (sidebar, topbar) so the whole tour
// runs on one page — it auto-starts on /chats, the login landing.
export const TOUR_STEPS: TourStep[] = [
  {
    id: "welcome",
    title: "Willkommen bei PromptPrinter",
    body: "Hier werden aus rohen Ideen build-fertige Prompts. Diese kurze Tour zeigt dir die wichtigsten Funktionen, sie dauert keine Minute.",
  },
  {
    id: "new-chat",
    selectors: ['[data-tour="new-chat"]'],
    title: "Alles beginnt mit einem Chat",
    body: "Über „Neuer Chat“ startest du von jeder Seite aus eine frische Unterhaltung. Beschreib dein Ziel, Finn baut den Prompt mit dir — und ein gutes Ergebnis hebst du dir als Projekt auf.",
  },
  {
    id: "nav",
    selectors: ['[data-tour="nav-main"]'],
    title: "Deine zwei Arbeitsorte",
    body: "Chats sammelt deine Unterhaltungen — die letzten stehen direkt hier in der Seitenleiste. Projekte ist das Zuhause für alles, was du dir aufhebst, mit allen Artefakten und dem Verlauf.",
  },
  {
    id: "mobile-menu",
    // Only visible below md — desktop drops this step automatically.
    selectors: ['[data-tour="mobile-menu"]'],
    title: "Deine Navigation",
    body: "Hinter diesem Menü findest du alles: neuen Chat starten, Chats, Projekte und Einstellungen.",
  },
  {
    id: "search",
    selectors: ['[data-tour="search"]'],
    title: "Suche",
    body: "Mit Strg + K (⌘ K am Mac) springst du blitzschnell zu jeder Seite oder jedem Projekt, ganz ohne Maus.",
  },
  {
    id: "account",
    selectors: ['[data-tour="topbar-actions"]'],
    title: "Design & Konto",
    body: "Hier wechselst du zwischen hellem und dunklem Design, siehst Benachrichtigungen und erreichst Einstellungen, Abrechnung und Logout.",
  },
  {
    id: "done",
    title: "Du bist startklar",
    body: "Leg los mit deinem ersten Prompt! Tipp: Du kannst diese Tour jederzeit in den Einstellungen unter „Hilfe & Onboarding“ neu starten.",
  },
];
