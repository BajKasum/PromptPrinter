"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { ArrowRight } from "lucide-react";
import { Logo } from "@/shared/brand/logo";
import { Button } from "@/shared/ui/button";
import { MenuToggleIcon } from "@/shared/ui/menu-toggle-icon";
import { NavWave } from "@/shared/ui/nav-wave";
import { HeaderWater } from "@/features/marketing/components/header-water";
import { cn } from "@/shared/lib/utils";

// Alle Punkte stehen direkt im Kopf, ohne Untermenü und ohne Gruppe "Für
// Entwickler" (Kasums Vorgabe): wer CLI oder MCP sucht, soll es mit einem Blick
// finden. "Funktionen" ist ein Anker auf der Landing Page (HowItWorks trägt
// id="funktionen"), die übrigen sind echte Seiten.
//
// `route` ist der Pfad, auf dem ein Punkt als aktuelle Seite gilt. Funktionen
// hat keinen: oben auf der Landing Page wäre er sonst markiert, obwohl man den
// Abschnitt noch nicht erreicht hat.
//
// CLI zeigt auf /terminal, weil /cli die Bestätigungsseite der Geräte-Anmeldung
// ist (app/(app)/cli/).
export const MARKETING_NAV = [
  { label: "Funktionen", href: "/#funktionen", route: null },
  { label: "Preise", href: "/pricing", route: "/pricing" },
  { label: "Skill", href: "/skill", route: "/skill" },
  { label: "CLI", href: "/terminal", route: "/terminal" },
  { label: "MCP", href: "/mcp", route: "/mcp" },
] as const;

// Ab dieser Breite stehen Links und Knöpfe in der Leiste, darunter öffnet der
// Menüknopf das Blatt. Fünf Punkte plus Logo und zwei Knöpfe passen erst ab lg.
const DESKTOP_QUERY = "(min-width: 1024px)";

export function Navbar() {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();

  // Kein Scroll mehr, solange das Menü offen ist.
  useEffect(() => {
    document.body.style.overflow = open ? "hidden" : "";
    return () => {
      document.body.style.overflow = "";
    };
  }, [open]);

  // Wächst das Fenster über den Umbruch, während das Menü offen ist, schliesst
  // es sich, sonst bliebe der Seiteninhalt gesperrt.
  useEffect(() => {
    const mq = window.matchMedia(DESKTOP_QUERY);
    const onChange = (e: MediaQueryListEvent) => {
      if (e.matches) setOpen(false);
    };
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, []);

  return (
    // Fest oben, und oben wie beim Scrollen gleich: keine Pille, keine
    // auftauchende Linie, kein Abdunkeln. Die Fläche ist eine Spur dunkler als
    // der Hero und leicht durchscheinend mit Blur, weil der Inhalt darunter
    // durchläuft (globals.css, .site-header-surface). Die Seiten tragen ihren
    // Abstand nach oben für diese 64 px selbst.
    <header className="fixed inset-x-0 top-0 z-50">
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-200 focus:rounded-lg focus:border focus:border-ring focus:bg-surface-raised focus:px-4 focus:py-2 focus:text-[13px] focus:text-foreground"
      >
        Zum Inhalt springen
      </a>

      <div
        aria-hidden
        className="site-header-surface pointer-events-none absolute inset-0"
      />
      <HeaderWater />

      <nav
        aria-label="Hauptnavigation"
        className="relative mx-auto flex h-16 w-full max-w-container items-center justify-between gap-4 px-6 md:px-8 lg:grid lg:grid-cols-[1fr_auto_1fr]"
      >
        {/* Drei Spalten ab lg: Logo links, die fünf Punkte wirklich mittig,
            die Knöpfe rechts. Die äusseren Spalten sind gleich breit, damit
            die Mitte die Mitte der Seite ist und nicht die des Restplatzes. */}
        <Link
          href="/"
          onClick={() => setOpen(false)}
          className="flex items-center justify-self-start transition-opacity hover:opacity-80"
        >
          <Logo accentWordmark />
        </Link>
        {/* Jeder Link trägt die Wasser-Pille und die Welle (globals.css,
              .nav-pill / .nav-wave), die aktuelle Seite behält beide. */}
        <div className="hidden items-center gap-2 lg:flex xl:gap-4">
          {MARKETING_NAV.map((item) => {
            const active = item.route !== null && pathname === item.route;
            // Der Anker ist bewusst ein natives <a>, die Seiten sind <Link>.
            const Tag = item.route === null ? "a" : Link;
            return (
              <Tag
                key={item.label}
                href={item.href}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "group focus-glow relative isolate rounded-full px-4 py-2 text-[14px] transition-colors duration-200",
                  active
                    ? "font-medium text-accent-text"
                    : "text-secondary hover:text-accent-text",
                )}
              >
                <span
                  aria-hidden
                  data-active={active}
                  className="nav-pill absolute inset-0 -z-10 rounded-full bg-accent-subtle"
                />
                {item.label}
                <NavWave active={active} />
              </Tag>
            );
          })}
        </div>

        {/* Kein Themen-Schalter: die öffentliche Seite bleibt hell, die Wahl
            liegt in den Einstellungen der App. */}
        <div className="flex items-center gap-2 justify-self-end">
          <Button
            asChild
            variant="ghost"
            size="sm"
            className="hidden lg:inline-flex"
          >
            <Link href="/login">Einloggen</Link>
          </Button>
          <Button
            asChild
            size="sm"
            variant="primary"
            className="hidden lg:inline-flex"
          >
            <Link href="/signup">Jetzt starten</Link>
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            onClick={() => setOpen((v) => !v)}
            aria-label={open ? "Menü schließen" : "Menü öffnen"}
            aria-expanded={open}
            aria-controls="mobile-menu"
            className="h-9 w-9 lg:hidden"
          >
            <MenuToggleIcon open={open} className="size-5" duration={300} />
          </Button>
        </div>
      </nav>

      {/* Das Blatt unter der Leiste, ganze Höhe. Geschlossen per display:none
          auch für Screenreader weg. */}
      <div
        id="mobile-menu"
        className={cn(
          "fixed inset-x-0 bottom-0 top-16 z-40 bg-background lg:hidden",
          open ? "block" : "hidden",
        )}
      >
        <div className="flex h-full flex-col justify-between gap-y-2 p-6 motion-safe:animate-menu-in">
          {/* Wie die Desktop-Links, auf eine volle Zeile übertragen: die Tönung
              liegt auf der ganzen Zeile, ein Pfeil erscheint statt der Welle.
              Nur Deckkraft, also nichts, was reduced-motion abfangen muss. */}
          <nav aria-label="Mobile Navigation" className="grid gap-y-1">
            {MARKETING_NAV.map((item) => {
              const active = item.route !== null && pathname === item.route;
              const Tag = item.route === null ? "a" : Link;
              return (
                <Tag
                  key={item.label}
                  href={item.href}
                  onClick={() => setOpen(false)}
                  aria-current={active ? "page" : undefined}
                  className={cn(
                    "group flex items-center rounded-lg px-3 py-3 text-base transition-colors duration-200",
                    active
                      ? "bg-accent-subtle font-medium text-accent-text"
                      : "text-foreground/85 hover:bg-accent-subtle hover:text-accent-text",
                  )}
                >
                  {item.label}
                  <ArrowRight
                    aria-hidden
                    strokeWidth={1.8}
                    className={cn(
                      "ml-auto h-4 w-4 text-accent-text transition-opacity duration-200",
                      active
                        ? "opacity-100"
                        : "opacity-0 group-hover:opacity-100",
                    )}
                  />
                </Tag>
              );
            })}
          </nav>
          <div className="flex flex-col gap-2">
            <Button asChild variant="ghost" className="w-full">
              <Link href="/login" onClick={() => setOpen(false)}>
                Einloggen
              </Link>
            </Button>
            <Button asChild variant="primary" className="w-full">
              <Link href="/signup" onClick={() => setOpen(false)}>
                Jetzt starten
              </Link>
            </Button>
          </div>
        </div>
      </div>
    </header>
  );
}
