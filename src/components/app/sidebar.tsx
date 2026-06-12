"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Sparkles } from "lucide-react";
import { Logo } from "@/components/brand/logo";
import { primaryNav, secondaryNav, comingSoonNav } from "@/lib/nav";
import { cn } from "@/lib/utils";

export function Sidebar() {
  const pathname = usePathname();
  return (
    <aside className="hidden md:flex fixed left-0 top-0 bottom-0 w-[240px] z-40 flex-col border-r border-border bg-surface">
      <div className="px-5 py-5 border-b border-border">
        <Link href="/dashboard" className="inline-flex">
          <Logo />
        </Link>
      </div>

      <div className="px-3 py-4 flex-1 overflow-y-auto">
        <Link
          href="/chat"
          data-tour="new-chat"
          className="flex items-center justify-center gap-2 mb-5 mx-1 h-10 rounded-lg bg-accent text-[13px] font-medium text-accent-foreground hover:bg-accent/90 active:scale-[0.97] transition-all duration-200"
        >
          <Sparkles className="h-3.5 w-3.5" />
          Neuer Chat
        </Link>

        <nav aria-label="Hauptbereiche" data-tour="nav-main" className="space-y-0.5">
          {primaryNav.map(({ label, href, Icon }) => {
            const active = pathname === href || pathname.startsWith(href + "/");
            return (
              <Link
                key={href}
                href={href}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "flex items-center gap-3 h-9 px-3 rounded-md text-[13.5px] transition-colors",
                  active
                    ? "bg-accent-subtle text-accent-text font-medium"
                    : "text-muted-foreground hover:text-foreground hover:bg-surface-hover"
                )}
              >
                <Icon className="h-4 w-4" strokeWidth={1.8} />
                <span>{label}</span>
              </Link>
            );
          })}
        </nav>

        <div className="my-5 h-px bg-border" />

        <nav aria-label="Konto" className="space-y-0.5">
          {secondaryNav.map(({ label, href, Icon }) => {
            const active = pathname === href || pathname.startsWith(href + "/");
            return (
              <Link
                key={href}
                href={href}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "flex items-center gap-3 h-9 px-3 rounded-md text-[13.5px] transition-colors",
                  active
                    ? "bg-accent-subtle text-accent-text font-medium"
                    : "text-muted-foreground hover:text-foreground hover:bg-surface-hover"
                )}
              >
                <Icon className="h-4 w-4" strokeWidth={1.8} />
                <span>{label}</span>
              </Link>
            );
          })}
        </nav>
      </div>

      <div className="px-3 py-4 border-t border-border space-y-0.5">
        {comingSoonNav.map(({ label, Icon }) => (
          <div
            key={label}
            className="flex items-center justify-between h-9 px-3 rounded-md text-[12.5px] text-muted-foreground/70 cursor-default select-none"
          >
            <span className="flex items-center gap-3">
              <Icon className="h-3.5 w-3.5" strokeWidth={1.8} />
              {label}
            </span>
            <span className="text-[9px] font-mono uppercase tracking-[0.08em] px-1.5 py-0.5 rounded-full border border-border bg-surface text-muted-foreground">
              Bald
            </span>
          </div>
        ))}
      </div>
    </aside>
  );
}
