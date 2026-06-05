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
    <aside className="hidden md:flex fixed left-0 top-0 bottom-0 w-[240px] z-40 flex-col border-r border-white/[0.06] glass-strong">
      <div className="px-5 py-5 border-b border-white/[0.06]">
        <Link href="/dashboard" className="inline-flex">
          <Logo />
        </Link>
      </div>

      <div className="px-3 py-4 flex-1 overflow-y-auto">
        <Link
          href="/new"
          className="flex items-center justify-center gap-2 mb-5 mx-1 h-10 rounded-lg bg-[#7C3AED] text-[13px] font-medium text-white shadow-[0_1px_0_rgba(255,255,255,0.12)_inset] hover:bg-[#8B5CF6] active:scale-[0.97] transition-all duration-200"
        >
          <Sparkles className="h-3.5 w-3.5" />
          Neues Projekt
        </Link>

        <nav aria-label="Hauptbereiche" className="space-y-0.5">
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
                    ? "bg-white/[0.06] text-white"
                    : "text-white/65 hover:text-white hover:bg-white/[0.04]"
                )}
              >
                <Icon className="h-4 w-4" strokeWidth={1.8} />
                <span>{label}</span>
              </Link>
            );
          })}
        </nav>

        <div className="my-5 h-px bg-white/[0.06]" />

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
                    ? "bg-white/[0.06] text-white"
                    : "text-white/65 hover:text-white hover:bg-white/[0.04]"
                )}
              >
                <Icon className="h-4 w-4" strokeWidth={1.8} />
                <span>{label}</span>
              </Link>
            );
          })}
        </nav>
      </div>

      <div className="px-3 py-4 border-t border-white/[0.06] space-y-0.5">
        {comingSoonNav.map(({ label, Icon }) => (
          <div
            key={label}
            className="flex items-center justify-between h-9 px-3 rounded-md text-[12.5px] text-white/40 cursor-default select-none"
          >
            <span className="flex items-center gap-3">
              <Icon className="h-3.5 w-3.5" strokeWidth={1.8} />
              {label}
            </span>
            <span className="text-[9px] font-mono uppercase tracking-[0.08em] px-1.5 py-0.5 rounded-full border border-white/[0.08] bg-white/[0.03] text-white/45">
              Bald
            </span>
          </div>
        ))}
      </div>
    </aside>
  );
}
