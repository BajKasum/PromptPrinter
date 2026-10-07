import type { SVGProps } from "react";

/**
 * Das GitHub-Symbol, als eigene Komponente statt aus lucide-react.
 *
 * lucide-react 1.0 hat alle Marken-Symbole entfernt (Chromium, Codepen, Codesandbox,
 * Dribbble, Facebook, Figma, Framer, Github, Gitlab, Instagram, LinkedIn, Pocket,
 * RailSymbol, Slack; Migrationsanleitung auf lucide.dev/guide/react/migration, gelesen
 * am 2026-10-07). Dieses Symbol war das einzige, das die App daraus nutzte
 * (project-brain.tsx). Als eigene Komponente läuft sie mit lucide-react 0.474 und 1.x
 * gleich, und das Symbol sieht danach genauso aus wie vorher.
 *
 * Die zwei Pfade sind die des Symbols `Github` aus lucide-react 0.474.0, unverändert.
 * Quelle: https://github.com/lucide-icons/lucide, Lizenz ISC:
 *   Copyright (c) for portions of Lucide are held by Cole Bemis 2013-2022 as part of
 *   Feather (MIT). All other copyright (c) for Lucide are held by Lucide Contributors 2022.
 * Die ISC-Lizenz erlaubt die Verwendung und Weitergabe, solange dieser Hinweis erhalten
 * bleibt (der volle Lizenztext liegt in node_modules/lucide-react/LICENSE).
 *
 * Gleiche Schnittstelle wie ein Lucide-Symbol, soweit die App sie nutzt: Größe über
 * className (die Attribute 24 x 24 sind der Standard von Lucide), Strichstärke über
 * strokeWidth (Standard 2), Farbe über currentColor.
 */
export function GithubIcon({ strokeWidth = 2, ...props }: Omit<SVGProps<SVGSVGElement>, "ref">) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width={24}
      height={24}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      // Reine Verzierung neben einer Beschriftung, wie jedes andere Symbol der App.
      aria-hidden="true"
      {...props}
    >
      <path d="M15 22v-4a4.8 4.8 0 0 0-1-3.5c3 0 6-2 6-5.5.08-1.25-.27-2.48-1-3.5.28-1.15.28-2.35 0-3.5 0 0-1 0-3 1.5-2.64-.5-5.36-.5-8 0C6 2 5 2 5 2c-.3 1.15-.3 2.35 0 3.5A5.403 5.403 0 0 0 4 9c0 3.5 3 5.5 6 5.5-.39.49-.68 1.05-.85 1.65-.17.6-.22 1.23-.15 1.85v4" />
      <path d="M9 18c-4.51 2-5-2-7-2" />
    </svg>
  );
}
