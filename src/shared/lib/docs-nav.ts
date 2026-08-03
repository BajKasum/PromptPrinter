// Single source of truth for the docs section: the sidebar, the index page's
// listing, the prev/next footer on each article and the sitemap all read this
// one array, so a new article is added in exactly one place.
//
// The order here is a deliberate reading path (Loslegen → Projekte →
// Einstellungen → Konto), not an alphabetical index: the docs are meant to be
// readable front to back on the first day, and each article's footer walks to
// the next one. `step` numbers in the UI are derived from this order.

export type DocArticle = {
  slug: string;
  title: string;
  /** One-line summary, shown on the index page and as the meta description. */
  summary: string;
};

export type DocGroup = {
  title: string;
  articles: DocArticle[];
};

export const DOCS_GROUPS: DocGroup[] = [
  {
    title: "Loslegen",
    articles: [
      {
        slug: "erste-schritte",
        title: "Erste Schritte",
        summary:
          "Konto anlegen, ersten Chat öffnen und in ein paar Minuten den ersten fertigen Prompt in der Hand halten.",
      },
      {
        slug: "chat-mit-finn",
        title: "Chat mit Finn",
        summary:
          "Warum Finn erst nachfragt statt sofort zu liefern, und wie du seine Rückfrage am schnellsten beantwortest.",
      },
      {
        slug: "der-fertige-prompt",
        title: "Der fertige Prompt",
        summary:
          "Kopieren, exportieren, nachschärfen: was im Prompt steht und wie du ihn ohne Neustart änderst.",
      },
    ],
  },
  {
    title: "Projekte",
    articles: [
      {
        slug: "projekte",
        title: "Projekte als Arbeitsplatz",
        summary:
          "Wenn du länger an einer Sache baust: ein Projekt hält Anweisungen, Struktur und mehrere Chats zusammen.",
      },
      {
        slug: "dateien",
        title: "Dateien im Projekt",
        summary:
          "Lade Notizen, Schemas oder Exporte hoch, damit Finn deinen Kontext kennt, ohne dass du ihn tippst.",
      },
      {
        slug: "ergebnisse",
        title: "Prompts speichern",
        summary:
          "Gute Prompts landen per Klick in den Ergebnissen des Projekts, zum Wiederfinden statt Wiederfinden-Müssen.",
      },
    ],
  },
  {
    title: "Modelle und Limits",
    articles: [
      {
        slug: "eigene-api-keys",
        title: "Eigene API-Keys",
        summary:
          "Häng deinen eigenen Anthropic-, OpenAI-, Gemini- oder OpenAI-kompatiblen Key an und rechne direkt über dein Konto ab.",
      },
      {
        slug: "plaene-und-limits",
        title: "Pläne und Limits",
        summary:
          "Was Free und Pro genau enthalten, welche Grenzen wirklich zählen und wann ein eigener Key sie aufhebt.",
      },
    ],
  },
  {
    title: "Konto",
    articles: [
      {
        slug: "konto-und-daten",
        title: "Konto und Daten",
        summary:
          "Passwort ändern, Anmeldewege, was gespeichert wird und wie du dein Konto restlos wieder löschst.",
      },
      {
        slug: "tastenkuerzel",
        title: "Tastenkürzel",
        summary:
          "Die Handvoll Tastenkürzel, mit denen du ohne Maus durch Chats, Projekte und Suche kommst.",
      },
    ],
  },
];

/** Flat reading order across all groups, drives step numbers and prev/next. */
export const DOCS_ORDER: DocArticle[] = DOCS_GROUPS.flatMap((g) => g.articles);

export function docHref(slug: string): string {
  return `/docs/${slug}`;
}

export function docBySlug(slug: string): DocArticle | undefined {
  return DOCS_ORDER.find((a) => a.slug === slug);
}

/** 1-based position in the reading path, for the "Schritt n von m" label. */
export function docStep(slug: string): number {
  return DOCS_ORDER.findIndex((a) => a.slug === slug) + 1;
}

/**
 * The articles before and after `slug` in the reading order; either side is
 * null at the ends, so the footer renders one link instead of two.
 */
export function docNeighbours(slug: string): {
  prev: DocArticle | null;
  next: DocArticle | null;
} {
  const i = DOCS_ORDER.findIndex((a) => a.slug === slug);
  if (i === -1) return { prev: null, next: null };
  return {
    prev: i > 0 ? DOCS_ORDER[i - 1] : null,
    next: i < DOCS_ORDER.length - 1 ? DOCS_ORDER[i + 1] : null,
  };
}
