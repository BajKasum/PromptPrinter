"use client";

import { LazyMotion, MotionConfig, domAnimation } from "framer-motion";

// `LazyMotion` mit `domAnimation` statt der vollen Engine: Animationen, Varianten, Hover/Tap/Fokus,
// `whileInView` und `AnimatePresence`-Exit bleiben, Layout-Animationen (`layout`) und Ziehen
// (`drag`) fallen weg, die die App nicht nutzt. Dafür gilt überall `m.*` statt `motion.*`
// (`tests/guards/lazy-motion.test.ts`), sonst läge die volle Engine wieder im ersten Chunk
// (Audit 2026-10-18, #135).
//
// Bewusst synchron (`features={domAnimation}`) und nicht als nachgeladener Chunk: gemessen
// (Lighthouse mobil, fünf Läufe im Wechsel) brachte das Nachladen keinen kürzeren Hauptthread,
// aber eine spätere größte Inhaltsdarstellung, weil jedes `initial={{ opacity: 0 }}` bis zum
// Eintreffen der Funktionen unsichtbar blieb.

/**
 * `prefers-reduced-motion` für den gesamten Baum, öffentlich wie eingeloggt.
 *
 * framer-motion respektiert die Systemeinstellung **nicht** von sich aus —
 * ohne dieses `reducedMotion="user"` animiert jede `m.*`-Komponente auch
 * dann, wenn der Nutzer im Betriebssystem Bewegung abbestellt hat.
 *
 * Sass bis Planpunkt B-2 im ThemeProvider und ist bei dessen Umzug in den
 * eingeloggten Bereich hier ausgezogen: das Theme ist eine Vorliebe, dies ist
 * eine Barrierefreiheits-Einstellung. Sie darf nicht davon abhängen, in
 * welchem Teil der App man gerade ist — die Landing Page ist mit Abstand die
 * bewegteste Fläche des Produkts.
 *
 * Eine Client-Komponente im Root-Layout macht die Seite **nicht** dynamisch;
 * nur ein `headers()`/`cookies()`-Aufruf täte das. Die öffentlichen Seiten
 * bleiben damit statisch ausliefer­bar.
 */
export function MotionShell({ children }: { children: React.ReactNode }) {
  return (
    <LazyMotion features={domAnimation}>
      <MotionConfig reducedMotion="user">{children}</MotionConfig>
    </LazyMotion>
  );
}
