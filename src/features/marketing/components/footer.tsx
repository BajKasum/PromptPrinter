import Link from "next/link";
import { Mascot } from "@/shared/brand/mascot";
import { NavWave } from "@/shared/ui/nav-wave";

// Finn's farewell: the page opens with him, it closes with him — image only,
// no sign-off line underneath (the words were the request to remove; the
// mascot itself stays). One flat row of links next to him, all sharing the
// navbar's own hover language (nav-pill + NavWave from shared/ui) instead of
// the navbar being the only place a hover does anything. Deliberately no
// product/legal weight split anymore (an earlier version sat the legal links
// quieter underneath): the request was one consistent link style for every
// page, not a hierarchy.
const FOOTER_LINKS = [
  // Anchor, not a route: "Wie es funktioniert" is a section of the landing
  // page again (see src/app/(marketing)/page.tsx). The leading "/" matters —
  // this footer is on /pricing too, where a bare "#funktionen" would scroll
  // nowhere.
  { href: "/#funktionen", label: "Funktionen" },
  { href: "/pricing", label: "Preise" },
  { href: "/docs", label: "Hilfe" },
  { href: "/ueber", label: "Über" },
  { href: "/kontakt", label: "Kontakt" },
  { href: "/datenschutz", label: "Datenschutz" },
  { href: "/agb", label: "AGB" },
  { href: "/rueckerstattung", label: "Rückerstattung" },
  { href: "/impressum", label: "Impressum" },
];

export function Footer() {
  return (
    <footer className="border-t border-border">
      <div className="container-x py-8 md:py-10">
        <div className="flex flex-col gap-5 md:flex-row md:items-center md:gap-6">
          <Mascot size={40} state="idle" alt="Finn" />
          <nav
            aria-label="Seiten"
            className="flex flex-wrap items-center gap-x-1 gap-y-1"
          >
            {FOOTER_LINKS.map((l) => (
              <Link
                key={l.href}
                href={l.href}
                className="group focus-glow relative isolate rounded-full px-3 py-1.5 text-[13px] text-secondary transition-colors duration-200 hover:text-accent-text"
              >
                <span
                  aria-hidden
                  className="nav-pill absolute inset-0 -z-10 rounded-full bg-accent-subtle"
                />
                {l.label}
                <NavWave active={false} />
              </Link>
            ))}
          </nav>
        </div>

        {/* No second border here on purpose — a rule above the links plus one
            above the copyright read as one footer split in two. One line, at
            the top of the whole block, is enough. */}
        <div className="mt-5 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-[12px] text-tertiary">
            © {new Date().getFullYear()} PromptPrinter
          </p>
          {/* Erbauer-Credit, wie auf Kundenprojekten der eigenen Agentur
              (z.B. kazuvate-Logo im Footer von ProMeti): Zeichen + Name,
              verlinkt auf kazuvate.ch. Eigene Tailwind-Token statt der
              kazuvate-eigenen Marken-Farbe, damit es zum PromptPrinter-Theme
              passt. */}
          <a
            href="https://kazuvate.ch"
            target="_blank"
            rel="noopener"
            aria-label="Website von kazuvate, öffnet in einem neuen Tab"
            className="focus-glow group inline-flex items-center gap-1.5 rounded-sm text-[12px] text-tertiary transition-opacity duration-200 hover:opacity-70"
          >
            <svg
              viewBox="0 0 585.51 442.90"
              className="h-3 w-auto"
              aria-hidden="true"
              focusable="false"
            >
              <path
                fill="currentColor"
                fillRule="evenodd"
                d="M0.00 0.19L79.97 0.39L80.19 169.50L153.51 170.08L283.43 0.19L380.99 0.15L222.91 208.75L314.29 442.90L226.95 442.73L153.34 250.65L79.93 250.95L79.93 442.90L0.03 442.90ZM256.87 212.24L328.91 117.34L382.37 254.94L487.38 0.26L585.51 0.00L417.18 442.90L346.61 442.90Z"
              />
            </svg>
            <span>kazuvate</span>
          </a>
        </div>
      </div>
    </footer>
  );
}
