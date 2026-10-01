import type { Metadata } from "next";

// Formulare gehören nicht in den Suchindex: wer "PromptPrinter" sucht, soll
// auf der Startseite landen, nicht auf einem Login-Feld. `follow` bleibt an,
// die Links auf diesen Seiten (AGB, Datenschutz, Startseite) darf ein Crawler
// weiterverfolgen.
//
// Gilt für alle vier Seiten der Gruppe. Das Canonical setzt jede Seite selbst:
// ohne eigenes `alternates` erbte sie das "/" aus dem Root-Layout und
// behauptete damit, die Startseite zu sein.
export const metadata: Metadata = {
  robots: { index: false, follow: true },
};

// Pass-through: every auth page (login, signup, password reset) renders its own
// full-bleed experience, so the group layout stays minimal.
export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
