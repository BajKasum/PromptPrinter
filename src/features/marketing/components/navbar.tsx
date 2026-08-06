"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { ArrowRight } from "lucide-react";
import { Logo } from "@/shared/brand/logo";
import { Button } from "@/shared/ui/button";
import { MenuToggleIcon } from "@/shared/ui/menu-toggle-icon";
import { NavWave } from "@/shared/ui/nav-wave";
import { cn } from "@/shared/lib/utils";

// "Preise" is a real route: its own page, worth linking to directly from
// anywhere on the site. "Funktionen" is back to an in-page anchor (#funktionen
// on HowItWorks) now that the landing page carries the explanation inline
// again (page.tsx's own comment has the full history) — next.config.ts keeps
// a redirect from the old /features URL for anyone who bookmarked it, but the
// navbar itself should link straight to the anchor, not round-trip through
// that redirect on every click.
//
// `route` is the pathname this item counts as "the page you're on", and only
// the real route has one. Funktionen is deliberately never marked active:
// highlighting it while you sit at the top of the landing page would claim
// you're in a section you haven't scrolled to yet.
const nav = [
  { label: "Funktionen", href: "/#funktionen", route: null },
  { label: "Preise", href: "/pricing", route: "/pricing" },
] as const;

export function Navbar() {
  const [scrolled, setScrolled] = useState(false);
  const [open, setOpen] = useState(false);
  const pathname = usePathname();

  // Shrink/blur the bar into a floating pill once the user leaves the top.
  // The logo collapse rides the same `scrolled` flag, so both land in the
  // same frame instead of firing at two different scroll depths.
  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  // Lock body scroll while the mobile menu is open.
  useEffect(() => {
    document.body.style.overflow = open ? "hidden" : "";
    return () => {
      document.body.style.overflow = "";
    };
  }, [open]);

  // The mobile panel is md:hidden, if the viewport grows past the breakpoint
  // while it's open, close it so we never leave the body scroll-locked.
  useEffect(() => {
    const mq = window.matchMedia("(min-width: 768px)");
    const onChange = (e: MediaQueryListEvent) => {
      if (e.matches) setOpen(false);
    };
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, []);

  return (
    <header className="fixed inset-x-0 top-0 z-50">
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-[200] focus:rounded-lg focus:border focus:border-ring focus:bg-surface-raised focus:px-4 focus:py-2 focus:text-[13px] focus:text-foreground"
      >
        Zum Inhalt springen
      </a>

      {/* The bar: full-width and transparent at the top; on scroll it contracts
          into a floating, hairline-bordered, blurred pill (desktop) / a solid
          blurred bar (mobile). Floating styles only apply when not in the open
          menu state, so the mobile panel always aligns under a top-anchored bar. */}
      <nav
        aria-label="Hauptnavigation"
        className={cn(
          "mx-auto flex w-full items-center justify-between gap-4 border-b border-transparent px-6 transition-all duration-300 ease-out md:border md:px-8",
          "h-16",
          scrolled && !open
            ? "max-w-[1200px] border-border bg-background/70 backdrop-blur-xl backdrop-saturate-150 md:mt-3 md:max-w-4xl md:rounded-2xl md:px-4 md:shadow-elevated"
            : "max-w-[1200px]",
          open && "border-border bg-background/90 backdrop-blur-xl"
        )}
      >
        {/* Left: brand + section links */}
        <div className="flex items-center gap-8">
          <Link
            href="/"
            onClick={() => setOpen(false)}
            className="flex items-center transition-opacity hover:opacity-80"
          >
            <Logo accentWordmark collapsed={scrolled} />
          </Link>
          {/* Section links. Hovering used to only darken the label to
              `foreground`: no feedback on the hit area, nothing to distinguish
              hover from the page you're actually on, and the one colour it
              reached for was the plain text colour rather than anything from
              the brand. Now each link carries a water pill that settles in
              behind it and a wave that swims in underneath (both in
              globals.css), and the current page keeps them on. */}
          <div className="hidden items-center gap-1 md:flex">
            {nav.map((item) => {
              const active = item.route !== null && pathname === item.route;
              // The anchor item is a native <a> on purpose (see `nav` above),
              // so the two link kinds can't share one element type.
              const Tag = item.route === null ? "a" : Link;
              return (
                <Tag
                  key={item.label}
                  href={item.href}
                  aria-current={active ? "page" : undefined}
                  className={cn(
                    "group focus-glow relative isolate rounded-full px-3.5 py-2 text-[13.5px] transition-colors duration-200",
                    active
                      ? "font-medium text-accent-text"
                      : "text-secondary hover:text-accent-text"
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
        </div>

        {/* Right: auth (desktop) / menu toggle (mobile). No theme switch here, the public site keeps one deliberate, always-light mood; theme
            choice lives in the logged-in app's settings instead. */}
        <div className="flex items-center gap-2">
          <Button
            asChild
            variant="ghost"
            size="sm"
            className="hidden md:inline-flex"
          >
            <Link href="/login">Einloggen</Link>
          </Button>
          <Button
            asChild
            size="sm"
            variant="primary"
            className="hidden md:inline-flex"
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
            className="h-9 w-9 md:hidden"
          >
            <MenuToggleIcon open={open} className="size-5" duration={300} />
          </Button>
        </div>
      </nav>

      {/* Mobile menu, full-height sheet below the bar. Hidden from the a11y
          tree (display:none) when closed. */}
      <div
        id="mobile-menu"
        className={cn(
          "fixed inset-x-0 bottom-0 top-16 z-40 border-t border-border bg-background/95 backdrop-blur-xl md:hidden",
          open ? "block" : "hidden"
        )}
      >
        <div className="flex h-full flex-col justify-between gap-y-2 p-6 motion-safe:animate-in motion-safe:fade-in-0 motion-safe:slide-in-from-top-2">
          {/* Same idea as the desktop links, adapted to a full-width row: the
              tint is the whole row instead of a pill, and a chevron fades in
              where the desktop wave would be (a centred wave under a
              left-aligned label reads as a stray mark). Opacity only, so
              nothing here needs a reduced-motion carve-out. */}
          <nav aria-label="Mobile Navigation" className="grid gap-y-1">
            {nav.map((item) => {
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
                      : "text-foreground/80 hover:bg-accent-subtle hover:text-accent-text"
                  )}
                >
                  {item.label}
                  <ArrowRight
                    aria-hidden
                    strokeWidth={1.8}
                    className={cn(
                      "ml-auto h-4 w-4 text-accent-text transition-opacity duration-200",
                      active ? "opacity-100" : "opacity-0 group-hover:opacity-100"
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
