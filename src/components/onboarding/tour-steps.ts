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
// always-rendered piece of the dashboard chrome (sidebar, topbar, dashboard
// sections) so the whole tour runs on one page — no mid-tour navigation.
export const TOUR_STEPS: TourStep[] = [
  {
    id: "welcome",
    title: "Willkommen bei PromptPrinter",
    body: "Hier werden aus rohen Ideen build-fertige Prompts. Diese kurze Tour zeigt dir die wichtigsten Funktionen, sie dauert keine Minute.",
  },
  {
    id: "modes",
    // New accounts see the big choice cards in the empty state; accounts with
    // projects fall back to the same two buttons in the dashboard header.
    selectors: ['[data-tour="start-cards"]', '[data-tour="quick-actions"]'],
    title: "Zwei Wege zum Prompt",
    body: "Prompt Chat baut alltägliche Prompts für ChatGPT, Claude & Co. Prompt Code erstellt komplette Build-Pakete: PRD, Schema und Prompts für Lovable, Cursor & Co.",
  },
  {
    id: "stats",
    selectors: ['[data-tour="stats"]'],
    title: "Dein Workspace auf einen Blick",
    body: "Projekte, Generierungen und dein aktueller Plan. Im Free-Plan nutzt du deine eigenen API-Keys; mit Pro ist die API inklusive und die Limits sind höher.",
  },
  {
    id: "new-chat",
    selectors: ['[data-tour="new-chat"]'],
    title: "Jederzeit neu starten",
    body: "Über „Neuer Chat“ in der Seitenleiste beginnst du von jeder Seite aus eine frische Unterhaltung mit dem Prompt-Assistenten.",
  },
  {
    id: "nav",
    selectors: ['[data-tour="nav-main"]'],
    title: "Alles Gespeicherte",
    body: "Projekte sammelt deine Build-Pakete, Chats deine Unterhaltungen. In der Bibliothek durchsuchst du alle Artefakte, Generierungen zeigt die Historie deiner Läufe.",
  },
  {
    id: "mobile-menu",
    // Only visible below md — desktop drops this step automatically.
    selectors: ['[data-tour="mobile-menu"]'],
    title: "Deine Navigation",
    body: "Hinter diesem Menü findest du alles: neuen Chat starten, Projekte, Bibliothek, Generierungen und Einstellungen.",
  },
  {
    id: "search",
    selectors: ['[data-tour="search"]'],
    title: "Befehls-Palette",
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
