"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Logo } from "@/components/brand/logo";
import { Button } from "@/components/ui/button";
import { ThemeToggle } from "@/components/ui/theme-toggle";
import { cn } from "@/lib/utils";

// In-page section links. Native <a> (not next/link) so the browser handles the
// hash jump — next/link is for route changes and scrolls unreliably to a bare
// hash in the App Router. Smooth scroll + the targets' scroll-mt do the rest.
const nav = [
  { label: "Funktionen", href: "#example" },
  { label: "Preise", href: "#preise" },
];

export function Navbar() {
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <header
      className={cn(
        "fixed top-0 left-0 right-0 z-50 transition-colors duration-300",
        scrolled ? "border-b border-border" : "border-b border-transparent"
      )}
    >
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-[200] focus:rounded-lg focus:border focus:border-ring focus:bg-surface-raised focus:px-4 focus:py-2 focus:text-[13px] focus:text-foreground"
      >
        Zum Inhalt springen
      </a>
      <div
        className={cn(
          "absolute inset-0 transition-opacity duration-300 bg-background/70 backdrop-blur-xl backdrop-saturate-150",
          scrolled ? "opacity-100" : "opacity-0"
        )}
      />
      <nav className="container-x relative flex h-16 items-center justify-between">
        {/* Left: logo + section links, grouped so nothing floats mid-bar */}
        <div className="flex items-center gap-8">
          <Link
            href="/"
            className="flex items-center transition-opacity hover:opacity-80"
          >
            <Logo />
          </Link>
          <div className="hidden md:flex items-center gap-1">
            {nav.map((item) => (
              <a
                key={item.label}
                href={item.href}
                className="rounded-md px-3 py-1.5 text-[13.5px] text-foreground/60 transition-colors hover:text-foreground"
              >
                {item.label}
              </a>
            ))}
          </div>
        </div>

        {/* Right: theme + auth */}
        <div className="flex items-center gap-2">
          <ThemeToggle />
          <Button asChild variant="ghost" size="sm" className="hidden sm:inline-flex">
            <Link href="/login">Einloggen</Link>
          </Button>
          <Button asChild size="sm" variant="primary">
            <Link href="/signup">Jetzt starten</Link>
          </Button>
        </div>
      </nav>
    </header>
  );
}
