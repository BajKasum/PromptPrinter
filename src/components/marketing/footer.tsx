import Link from "next/link";
import { Logo } from "@/components/brand/logo";

const sections = [
  {
    title: "Produkt",
    links: [
      { label: "Funktionen", href: "/features" },
      { label: "Preise", href: "/pricing" },
      { label: "Changelog", href: "#" },
      { label: "Roadmap", href: "#" },
    ],
  },
  {
    title: "Ressourcen",
    links: [
      { label: "Dokumentation", href: "#" },
      { label: "API-Referenz", href: "#" },
      { label: "Beispiele", href: "#" },
      { label: "Vorlagen", href: "#" },
    ],
  },
  {
    title: "Unternehmen",
    links: [
      { label: "Über uns", href: "#" },
      { label: "Blog", href: "#" },
      { label: "Karriere", href: "#" },
      { label: "Kontakt", href: "#" },
    ],
  },
  {
    title: "Rechtliches",
    links: [
      { label: "Impressum", href: "/impressum" },
      { label: "Datenschutz", href: "/datenschutz" },
      { label: "AGB", href: "/agb" },
    ],
  },
];

export function Footer() {
  return (
    <footer className="relative border-t border-border mt-32">
      <div className="container-x py-16">
        <div className="grid grid-cols-2 md:grid-cols-6 gap-8">
          <div className="col-span-2">
            <Logo />
            <p className="mt-4 max-w-xs text-sm text-foreground/55 leading-relaxed">
              Von der rohen Idee zum build-fertigen Blueprint. Präzisionsgefertigte Prompts für
              den modernen KI-Stack.
            </p>
          </div>
          {sections.map((s) => (
            <div key={s.title} className="text-sm">
              <div className="font-mono uppercase tracking-[0.08em] text-[11px] text-foreground/45 mb-4">
                {s.title}
              </div>
              <ul className="space-y-2.5">
                {s.links.map((l) => (
                  <li key={l.label}>
                    <Link href={l.href} className="text-foreground/70 hover:text-foreground transition-colors">
                      {l.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
        <div className="mt-16 pt-8 border-t border-border flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
          <p className="text-xs text-foreground/45">
            © {new Date().getFullYear()} PromptPrinter. Präzisionsgefertigt.
          </p>
          <div className="flex items-center gap-4 text-xs text-foreground/45">
            <span className="font-mono">v2.0 Beta</span>
            <span className="h-3 w-px bg-surface" />
            <span className="inline-flex items-center gap-1.5">
              <span className="relative inline-flex h-1.5 w-1.5">
                <span className="absolute inset-0 rounded-full bg-success opacity-75 animate-ping" />
                <span className="relative h-1.5 w-1.5 rounded-full bg-success" />
              </span>
              Alle Systeme betriebsbereit
            </span>
          </div>
        </div>
      </div>
    </footer>
  );
}
