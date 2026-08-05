"use client";

import { ThemeProvider as NextThemesProvider } from "next-themes";
import type { ComponentProps } from "react";

/**
 * next-themes, gemountet **nur im eingeloggten Bereich** (`(app)/layout.tsx`).
 *
 * ─── Warum nicht mehr im Root-Layout ──────────────────────────────────────
 * next-themes setzt ein Anti-Flash-Inline-Script, und das braucht den
 * CSP-Nonce. Der Nonce kam über `headers()` im Root-Layout — ein Aufruf, der
 * **den gesamten Routenbaum** dynamisch macht. Seit Planpunkt B-2 sollen die
 * öffentlichen Seiten statisch vom CDN kommen, also darf dort nichts mehr
 * `headers()` lesen.
 *
 * ─── Warum die öffentlichen Seiten dadurch nichts verlieren ───────────────
 * Sie hatten nie eine Theme-Wahl. Hier stand vorher ein
 * `forcedTheme = isAppRoute(pathname) ? undefined : "light"`, mit der
 * ausdrücklichen Begründung: „the public site keeps one deliberate,
 * always-light mood (no header toggle); theme choice is a workspace
 * preference that only applies once you're actually inside the app."
 * Das Ergebnis ist heute dasselbe wie vorher — hell —, es kostet nur kein
 * Script mehr, sondern ergibt sich daraus, dass `:root` in globals.css der
 * helle Satz ist und dort keine Theme-Klasse gesetzt wird.
 *
 * ─── Was dabei ersatzlos wegfällt, und das ist der Gewinn ─────────────────
 * `isAppRoute()` mit seiner handgepflegten Präfixliste. Die musste jede neue
 * Route unter `(app)` kennen, und laut ihrem eigenen Kommentar war sie
 * bereits zweimal hinterher (`/prompts`, `/admin` rendertem eine Zeit lang
 * zwangshell). Ein Test hielt die Liste gegen das Dateisystem — nötig, weil
 * der Mechanismus fehleranfällig war. Jetzt entscheidet die Verzeichnisstruktur
 * selbst: der Provider existiert nur unter `(app)`, also kann eine neue Route
 * dort gar nicht mehr vergessen werden.
 *
 * MotionConfig sitzt bewusst NICHT hier, sondern im Root-Layout
 * (`motion-shell.tsx`): reduced-motion ist eine Barrierefreiheits-Einstellung
 * und muss auch auf den öffentlichen Seiten gelten.
 */
export function ThemeProvider({
  children,
  ...props
}: ComponentProps<typeof NextThemesProvider>) {
  return <NextThemesProvider {...props}>{children}</NextThemesProvider>;
}
