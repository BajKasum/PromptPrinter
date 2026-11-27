import { ImageResponse } from "next/og";

// Die Vorschaukarte (1200 x 630) beim Teilen eines Links, gezeichnet für die Startseite (app/opengraph-image.tsx)
// und für jede Hilfe-, Vergleichs- und Aufgabenseite (app/og/[kind]/[slug]/route.tsx). Beide Routen laufen auf der
// Edge-Runtime, das Modul braucht deshalb nur next/og und keinen window-Zweig.

export const SOCIAL_CARD_SIZE = { width: 1200, height: 630 };

// Die Karte wird als Bild gezeichnet, ohne die CSS-Variablen der App: die Markenfarben stehen hier als Werte.
const BACKGROUND = "#0C0E12";
const ACCENT = "#8FCDF2";
const TEXT = "#E8EBEF";
/** ACCENT als Zahlen, für die Stufen mit Deckkraft. */
const ACCENT_RGB = "143,205,242";

/** Der Titel einer Seite, oder der Slogan der Startseite in zwei Farben. */
export type SocialCardTitle = string | { lead: string; highlight: string };

/**
 * Der Hostname unten rechts auf der Karte: NEXT_PUBLIC_APP_URL ohne Schema und Schrägstrich am Ende. Ein falscher
 * Wert fiele nur in geteilten Vorschauen auf, er steht in einem Bild. Ohne die Variable gilt localhost, in
 * Produktion verlangt sie der Start (server/env.ts). Nicht siteUrl(): dessen window-Zweig gehört nicht in den
 * Edge-Bundle.
 */
export function displayHost(): string {
  const raw = process.env.NEXT_PUBLIC_APP_URL;
  if (!raw) return "localhost:3000";
  return raw.replace(/^https?:\/\//, "").replace(/\/+$/, "");
}

export function renderSocialCard({
  label,
  title,
  headers,
}: {
  /** Die kleine Zeile über dem Titel. */
  label: string;
  title: SocialCardTitle;
  headers?: Record<string, string>;
}) {
  return new ImageResponse(
    (
      <div
        style={{
          height: "100%",
          width: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          background: BACKGROUND,
          backgroundImage: `radial-gradient(900px 480px at 75% 0%, rgba(${ACCENT_RGB},0.18), transparent)`,
          padding: "80px",
          fontFamily: "sans-serif",
        }}
      >
        <div style={{ display: "flex", alignItems: "center" }}>
          <div
            style={{
              fontSize: 22,
              letterSpacing: "0.12em",
              textTransform: "uppercase",
              color: ACCENT,
              border: `1px solid rgba(${ACCENT_RGB},0.4)`,
              background: `rgba(${ACCENT_RGB},0.12)`,
              borderRadius: 999,
              padding: "8px 18px",
            }}
          >
            {label}
          </div>
        </div>

        {titleBlock(title)}

        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            color: "rgba(255,255,255,0.55)",
            fontSize: 28,
          }}
        >
          <div style={{ display: "flex", color: "white", fontWeight: 600 }}>PromptPrinter</div>
          <div style={{ display: "flex" }}>{displayHost()}</div>
        </div>
      </div>
    ),
    { ...SOCIAL_CARD_SIZE, headers }
  );
}

function titleBlock(title: SocialCardTitle) {
  const type = { fontWeight: 700, letterSpacing: "-0.03em" } as const;

  if (typeof title === "string") {
    // Ein langer Titel bekommt eine kleinere Schrift, damit er auf die Karte passt.
    const fontSize = title.length > 48 ? 56 : 72;
    return <div style={{ ...type, display: "flex", fontSize, lineHeight: 1.1, color: TEXT }}>{title}</div>;
  }

  return (
    <div style={{ ...type, display: "flex", flexWrap: "wrap", fontSize: 76, lineHeight: 1.05 }}>
      <span style={{ color: TEXT }}>{title.lead}</span>
      <span style={{ color: ACCENT }}>{title.highlight}</span>
    </div>
  );
}
