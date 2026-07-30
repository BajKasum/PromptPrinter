import Link from "next/link";
import { Mascot } from "@/components/brand/mascot";

// Finn's farewell plus every public page. Deliberately two staggered rows
// rather than the usual four-column corporate footer (see DESIGN.md): the
// product links carry normal weight, the legal ones sit quieter underneath,
// so the hierarchy is visible without turning the footer into a sitemap wall.

const PRODUCT_LINKS = [
  // Anchor, not a route: "Wie es funktioniert" is a section of the landing page
  // again (see src/app/page.tsx). The leading "/" matters — this footer is on
  // /pricing too, where a bare "#funktionen" would scroll nowhere.
  { href: "/#funktionen", label: "Funktionen" },
  { href: "/pricing", label: "Preise" },
  { href: "/docs", label: "Hilfe" },
  { href: "/ueber", label: "Über" },
  { href: "/kontakt", label: "Kontakt" },
];

const LEGAL_LINKS = [
  { href: "/datenschutz", label: "Datenschutz" },
  { href: "/agb", label: "AGB" },
  { href: "/rueckerstattung", label: "Rückerstattung" },
  { href: "/impressum", label: "Impressum" },
];

export function Footer() {
  return (
    <footer className="border-t border-border">
      <div className="container-x py-12 md:py-14">
        <div className="flex flex-col gap-9 md:flex-row md:items-start md:justify-between">
          {/* Finn's sign-off: the page opens with him, it closes with him. */}
          <div className="flex items-center gap-4">
            <Mascot size={44} state="idle" alt="Finn" />
            <p className="text-[15px] leading-snug text-secondary">
              Schön, dass du da warst.
              <br />
              <span className="text-tertiary">· Finn</span>
            </p>
          </div>

          <div className="flex flex-col gap-3 md:items-end">
            <nav
              aria-label="Seiten"
              className="flex flex-wrap gap-x-6 gap-y-2 text-[13.5px] text-secondary md:justify-end"
            >
              {/* Accent on hover, not `foreground`: these are links, and
                  DESIGN.md's accent rules put links on `accent-text`. Darkening
                  to the body-text colour made hovering look like nothing much
                  happened, the same complaint the navbar had. */}
              {PRODUCT_LINKS.map((l) => (
                <Link
                  key={l.href}
                  href={l.href}
                  className="focus-glow rounded-sm underline-offset-4 transition-colors duration-200 hover:text-accent-text hover:underline"
                >
                  {l.label}
                </Link>
              ))}
            </nav>
            <nav
              aria-label="Rechtliches"
              className="flex flex-wrap gap-x-5 gap-y-2 text-[12.5px] text-tertiary md:justify-end"
            >
              {LEGAL_LINKS.map((l) => (
                <Link
                  key={l.href}
                  href={l.href}
                  className="focus-glow rounded-sm underline-offset-4 transition-colors duration-200 hover:text-accent-text hover:underline"
                >
                  {l.label}
                </Link>
              ))}
            </nav>
          </div>
        </div>

        <div className="mt-8 border-t border-border pt-6">
          <p className="text-[12px] text-tertiary">
            © {new Date().getFullYear()} PromptPrinter
          </p>
        </div>
      </div>
    </footer>
  );
}
