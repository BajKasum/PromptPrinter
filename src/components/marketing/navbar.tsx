"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Logo } from "@/components/brand/logo";
import { Button } from "@/components/ui/button";
import { MenuToggleIcon } from "@/components/ui/menu-toggle-icon";
import { cn } from "@/lib/utils";

// Real routes, not in-page anchors. Both used to point at sections of the
// landing page (#produkt / #preise), so "Funktionen" and "Preise" only ever
// scrolled you further down one long page and were unreachable from anywhere
// else on the site. They're their own destinations now, which is also why
// these are next/link again — the hash-jump workaround that anchors needed
// doesn't apply to route changes.
const nav = [
  { label: "Funktionen", href: "/features" },
  { label: "Preise", href: "/pricing" },
];

export function Navbar() {
  const [scrolled, setScrolled] = useState(false);
  const [open, setOpen] = useState(false);

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
          <div className="hidden items-center gap-1 md:flex">
            {nav.map((item) => (
              <Link
                key={item.label}
                href={item.href}
                className="rounded-md px-3 py-1.5 text-[13.5px] text-secondary transition-colors hover:text-foreground"
              >
                {item.label}
              </Link>
            ))}
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
          <nav aria-label="Mobile Navigation" className="grid gap-y-1">
            {nav.map((item) => (
              <Link
                key={item.label}
                href={item.href}
                onClick={() => setOpen(false)}
                className="rounded-lg px-3 py-3 text-base text-foreground/80 transition-colors hover:bg-surface-hover hover:text-foreground"
              >
                {item.label}
              </Link>
            ))}
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
