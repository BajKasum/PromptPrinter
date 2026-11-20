import type { SVGProps } from "react";

/**
 * Das LinkedIn-Symbol, als eigene Komponente wie GithubIcon (github-icon.tsx): lucide-react 1.0 hat die
 * Marken-Symbole entfernt.
 *
 * Die drei Formen sind die des Symbols `Linkedin` aus lucide-react 0.474.0, unverändert.
 * Quelle: https://github.com/lucide-icons/lucide, Lizenz ISC:
 *   Copyright (c) for portions of Lucide are held by Cole Bemis 2013-2022 as part of
 *   Feather (MIT). All other copyright (c) for Lucide are held by Lucide Contributors 2022.
 * Die ISC-Lizenz erlaubt die Verwendung und Weitergabe, solange dieser Hinweis erhalten bleibt.
 *
 * Gleiche Schnittstelle wie ein Lucide-Symbol: Größe über className, Strichstärke über strokeWidth (Standard 2),
 * Farbe über currentColor.
 */
export function LinkedinIcon({ strokeWidth = 2, ...props }: Omit<SVGProps<SVGSVGElement>, "ref">) {
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
      <path d="M16 8a6 6 0 0 1 6 6v7h-4v-7a2 2 0 0 0-2-2 2 2 0 0 0-2 2v7h-4v-7a6 6 0 0 1 6-6z" />
      <rect width="4" height="12" x="2" y="9" />
      <circle cx="4" cy="4" r="2" />
    </svg>
  );
}
