import { notFound } from "next/navigation";

// Unbekannte Adresse unter /settings/...: ohne diese Auffangroute ginge sie an die statische Root-404, und die
// hydriert unter der Nonce-Policy der App (middleware.ts) nicht, eingeloggt bliebe die Seite leer (#149).
// So rendert die 404 des App-Layouts, mit Seitenleiste und Weg zurueck.
export default function UnknownSettingsPath(): never {
  notFound();
}
