import type { Metadata } from "next";

const SITE_NAME = "PromptPrinter";

/** Die Karte aus src/app/opengraph-image.tsx, Grösse wie dort festgelegt. */
const SOCIAL_IMAGE = {
  url: "/opengraph-image",
  width: 1200,
  height: 630,
  alt: "PromptPrinter, Aus rohen Ideen build-fertige Prompts",
};

/**
 * Die Metadaten einer öffentlichen Seite aus einer Hand.
 *
 * Next merged `alternates`, `openGraph` und `twitter` nicht pro Feld: was eine
 * Seite nicht selbst setzt, erbt sie als ganzes Objekt aus dem Root-Layout.
 * Das hat zweimal zu stillen Fehlern geführt:
 *
 * - Ohne eigenes `alternates` trug jede Unterseite das Canonical "/" und gab
 *   sich als Startseite aus (behoben am 28.09.2026, bei den Formularseiten am
 *   01.10.2026).
 * - Ohne eigenes `openGraph` zeigte jede geteilte Unterseite Titel,
 *   Beschreibung und `og:url` der Startseite. Ein Link auf /pricing in
 *   WhatsApp, Slack oder LinkedIn sah aus wie ein Link auf die Startseite.
 *
 * Deshalb setzt diese Funktion alle drei aus denselben drei Angaben.
 *
 * Das Vorschaubild muss dabei ausdrücklich mit: Next hängt das Bild aus
 * src/app/opengraph-image.tsx nur an das `openGraph` des Segments, in dem die
 * Datei liegt (das Root-Layout). Eine Seite mit eigenem `openGraph` ersetzt
 * dieses Objekt ganz und stünde ohne Bild da (am gebauten HTML gesehen).
 *
 * `path` ist relativ, `metadataBase` im Root-Layout macht daraus die
 * absolute Adresse.
 */
export function pageMetadata({
  title,
  description,
  path,
}: {
  /** Kurz, ohne Markenname: das Root-Layout hängt " · PromptPrinter" an. */
  title: string;
  description: string;
  /** Der Pfad der Seite, z. B. "/pricing". */
  path: string;
}): Metadata {
  const socialTitle = `${title} · ${SITE_NAME}`;
  return {
    title,
    description,
    alternates: { canonical: path },
    openGraph: {
      title: socialTitle,
      description,
      url: path,
      siteName: SITE_NAME,
      type: "website",
      locale: "de_CH",
      images: [SOCIAL_IMAGE],
    },
    twitter: {
      card: "summary_large_image",
      title: socialTitle,
      description,
      images: [SOCIAL_IMAGE],
    },
  };
}
