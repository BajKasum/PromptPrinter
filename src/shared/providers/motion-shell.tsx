"use client";

import { MotionConfig } from "framer-motion";

/**
 * `prefers-reduced-motion` für den gesamten Baum, öffentlich wie eingeloggt.
 *
 * framer-motion respektiert die Systemeinstellung **nicht** von sich aus —
 * ohne dieses `reducedMotion="user"` animiert jede `motion.*`-Komponente auch
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
  return <MotionConfig reducedMotion="user">{children}</MotionConfig>;
}
