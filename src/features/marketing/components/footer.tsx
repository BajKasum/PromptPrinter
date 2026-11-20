import Link from "next/link";
import { Globe } from "lucide-react";
import { Mascot } from "@/shared/brand/mascot";
import { Button } from "@/shared/ui/button";
import { GithubIcon } from "@/shared/ui/github-icon";
import { LinkedinIcon } from "@/shared/ui/linkedin-icon";
import { REPO_URL } from "@/features/marketing/lib/open-source";
import { LINKEDIN_URL, PORTFOLIO_URL } from "@/features/marketing/lib/author-links";

// Finns Abschied: die Seite beginnt mit ihm und endet mit ihm. Links Finn, ein Satz in seiner Stimme und drei
// blaue Knöpfe nach draussen (der Code, LinkedIn, das Portfolio), rechts die Seiten in drei Spalten mit
// Überschrift, darunter eine Linie und das Copyright. Jede öffentliche Seite steht genau einmal hier;
// footer.test.tsx prüft, dass es sie gibt.
export const FOOTER_GROUPS = [
  {
    title: "Produkt",
    links: [
      // Ein Sprungziel auf der Landing Page, keine Route. Der führende "/" zählt: der Footer steht auf jeder
      // öffentlichen Seite, ein blosses "#funktionen" spränge dort ins Leere.
      { href: "/#funktionen", label: "Funktionen" },
      { href: "/open-source", label: "Open Source" },
      { href: "/skill", label: "Skill" },
      { href: "/terminal", label: "CLI" },
      { href: "/mcp", label: "MCP" },
    ],
  },
  {
    title: "Hilfe und Kontakt",
    links: [
      { href: "/docs", label: "Hilfe" },
      { href: "/vergleich", label: "Vergleiche" },
      { href: "/ueber", label: "Über PromptPrinter" },
      { href: "/kontakt", label: "Kontakt" },
    ],
  },
  {
    title: "Rechtliches",
    links: [
      { href: "/impressum", label: "Impressum" },
      { href: "/datenschutz", label: "Datenschutz" },
      { href: "/cookies", label: "Cookies" },
      { href: "/agb", label: "AGB" },
      { href: "/nutzungsrichtlinie", label: "Nutzungsrichtlinie" },
    ],
  },
] as const;

/** Die drei Knöpfe nach draussen, in dieser Reihenfolge. */
export const FOOTER_BUTTONS = [
  { href: REPO_URL, label: "GitHub", Icon: GithubIcon },
  { href: LINKEDIN_URL, label: "LinkedIn", Icon: LinkedinIcon },
  { href: PORTFOLIO_URL, label: "Portfolio", Icon: Globe },
] as const;

export function Footer() {
  return (
    <footer className="border-t border-border">
      <div className="container-x pb-8 pt-12 md:pt-16">
        <div className="grid gap-10 md:grid-cols-[minmax(0,5fr)_minmax(0,7fr)] md:gap-12">
          <div>
            <Mascot size={48} state="idle" alt="Finn" />
            <p className="mt-4 max-w-xs text-[14px] leading-[1.6] text-secondary">
              Ich mache aus deiner Idee den fertigen Prompt. Kostenlos und Open Source.
            </p>
            <div className="mt-6 flex flex-wrap gap-2.5">
              {FOOTER_BUTTONS.map(({ href, label, Icon }) => (
                <Button key={href} asChild variant="accent">
                  <a href={href} target="_blank" rel="noopener">
                    <Icon className="h-4 w-4" strokeWidth={1.8} aria-hidden />
                    {label}
                  </a>
                </Button>
              ))}
            </div>
          </div>

          <nav aria-label="Seiten" className="grid grid-cols-2 gap-x-6 gap-y-8 sm:grid-cols-3">
            {FOOTER_GROUPS.map((group) => (
              <div key={group.title}>
                <h2 className="text-[13px] font-semibold tracking-[-0.01em] text-foreground">{group.title}</h2>
                <ul className="mt-3 space-y-1">
                  {group.links.map((link) => (
                    <li key={link.href}>
                      {/* 32 px hoch, auf Touch mit 44 px Trefferfläche (globals.css), ohne die Liste zu strecken. */}
                      <Link
                        href={link.href}
                        className="touch-hit-y focus-glow relative inline-block rounded-sm py-1.5 text-[14px] leading-5 text-secondary transition-colors duration-200 hover:text-foreground"
                      >
                        {link.label}
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </nav>
        </div>

        <p className="mt-12 border-t border-border pt-6 text-[12px] text-tertiary">
          © {new Date().getFullYear()} PromptPrinter
        </p>
      </div>
    </footer>
  );
}
