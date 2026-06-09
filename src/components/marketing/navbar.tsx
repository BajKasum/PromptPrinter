"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Logo } from "@/components/brand/logo";
import { Button } from "@/components/ui/button";
import { ThemeToggle } from "@/components/ui/theme-toggle";
import { cn } from "@/lib/utils";

// In-page anchors to real sections — no dead links, no thin extra pages.
const nav = [
  { label: "Funktionen", href: "#funktionen" },
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
        "fixed top-0 left-0 right-0 z-50 transition-all duration-300",
        scrolled ? "border-b border-border" : "border-b border-transparent"
      )}
    >
      <div
        className={cn(
          "absolute inset-0 transition-opacity duration-300 bg-background/70 backdrop-blur-xl backdrop-saturate-150",
          scrolled ? "opacity-100" : "opacity-0"
        )}
      />
      <nav className="container-x relative flex h-16 items-center justify-between">
        <Link href="/" className="flex items-center transition-opacity hover:opacity-80">
          <Logo />
        </Link>
        <div className="hidden md:flex items-center gap-1">
          {nav.map((item) => (
            <Link
              key={item.label}
              href={item.href}
              className="px-3 py-1.5 text-[13.5px] text-foreground/65 hover:text-foreground transition-colors rounded-md"
            >
              {item.label}
            </Link>
          ))}
        </div>
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
