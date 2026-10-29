import { notFound } from "next/navigation";

// Unbekannte Adresse unter /cli/...: ohne diese Auffangroute ginge sie an die statische Root-404, und die
// hydriert unter der Nonce-Policy der App (middleware.ts) nicht, eingeloggt bliebe die Seite leer (#149).
export default function UnknownCliPath(): never {
  notFound();
}
