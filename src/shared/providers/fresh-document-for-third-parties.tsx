"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { needsFreshDocument } from "@/shared/lib/third-party-paths";

/**
 * Lädt die Seite neu, wenn ein Seitenwechsel im Browser eine Seite erreicht, deren
 * Drittanbieter (Cloudflare Turnstile, Lemon Squeezy) die Policy des geladenen
 * Dokuments sperrt.
 *
 * Warum, im Einzelnen: shared/lib/third-party-paths.ts. Kurz: die Content-Security-Policy
 * kommt mit dem Dokument und je nach Pfad; Next.js wechselt die Seite ohne neues
 * Dokument. Ohne diese Komponente scheitert das Captcha nach dem Weg Startseite → Login
 * oder nach dem Abmelden, und der Checkout nach dem Weg Chat → Pläne (dort fällt er auf
 * die Seite bei Lemon Squeezy zurück, statt als Fenster aufzugehen).
 *
 * Gewählt ist ein Neuladen NACH dem Wechsel statt eines Abfangens der Klicks, weil es
 * jeden Weg erfasst: Links, `router.push`, Zurück/Vor, serverseitige Weiterleitungen.
 * Der Preis ist ein kurzes Aufblitzen der Zielseite. Eine Schleife ist ausgeschlossen:
 * nach dem Neuladen ist der Pfad des Dokuments der aktuelle, und `needsFreshDocument`
 * ist dann falsch.
 *
 * Gerendert wird nichts. Im Root-Layout eingebunden (tests/guards/fresh-document.test.ts
 * hält das fest); eine Client-Komponente mit `usePathname` macht die öffentlichen Seiten
 * nicht dynamisch (static-public-pages.test.ts).
 */
export function FreshDocumentForThirdParties() {
  const pathname = usePathname();
  // Der Pfad, unter dem DIESES Dokument geladen wurde: das Layout hängt über Seitenwechsel
  // hinweg, der Anfangswert bleibt. Auf dem Server null, dort gibt es nichts zu laden.
  const [documentPath] = useState<string | null>(() =>
    typeof window === "undefined" ? null : window.location.pathname
  );

  useEffect(() => {
    if (documentPath !== null && needsFreshDocument(documentPath, pathname)) {
      window.location.reload();
    }
  }, [documentPath, pathname]);

  return null;
}
