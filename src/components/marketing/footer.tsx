import Link from "next/link";
import { Mascot } from "@/components/brand/mascot";

// Finn's farewell plus every public page. Deliberately two staggered rows
// rather than the usual four-column corporate footer (see DESIGN.md): the
// product links carry normal weight, the legal ones sit quieter underneath,
// so the hierarchy is visible without turning the footer into a sitemap wall.

const PRODUCT_LINKS = [
  { href: "/features", label: "Funktionen" },
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
            <p className="text-[15px] leading-snug text-foreground/60">
              Schön, dass du da warst.
              <br />
              <span className="text-foreground/40">· Finn</span>
            </p>
          </div>

          <div className="flex flex-col gap-3 md:items-end">
            <nav
              aria-label="Seiten"
              className="flex flex-wrap gap-x-6 gap-y-2 text-[13.5px] text-foreground/65 md:justify-end"
            >
              {PRODUCT_LINKS.map((l) => (
                <Link
                  key={l.href}
                  href={l.href}
                  className="transition-colors hover:text-foreground"
                >
                  {l.label}
                </Link>
              ))}
            </nav>
            <nav
              aria-label="Rechtliches"
              className="flex flex-wrap gap-x-5 gap-y-2 text-[12.5px] text-foreground/45 md:justify-end"
            >
              {LEGAL_LINKS.map((l) => (
                <Link
                  key={l.href}
                  href={l.href}
                  className="transition-colors hover:text-foreground"
                >
                  {l.label}
                </Link>
              ))}
            </nav>
          </div>
        </div>

        <div className="mt-8 border-t border-border pt-6">
          <p className="text-[12px] text-foreground/35">
            © {new Date().getFullYear()} PromptPrinter
          </p>
        </div>
      </div>
    </footer>
  );
}
