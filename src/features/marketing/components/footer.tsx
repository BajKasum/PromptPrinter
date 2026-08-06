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
        <p className="mt-5 text-[12px] text-tertiary">
          © {new Date().getFullYear()} PromptPrinter
        </p>
      </div>
    </footer>
  );
}
