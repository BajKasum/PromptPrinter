"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  FolderOpen,
  Sparkles,
  Library,
  Settings,
  CreditCard,
  HelpCircle,
  BookOpen,
} from "lucide-react";
import { Logo } from "@/components/brand/logo";
import { cn } from "@/lib/utils";

const primary = [
  { label: "Dashboard", href: "/dashboard", Icon: LayoutDashboard },
  { label: "Projekte", href: "/projects", Icon: FolderOpen },
  { label: "Bibliothek", href: "/library", Icon: Library },
  { label: "Generierungen", href: "/generations", Icon: Sparkles },
];

const secondary = [
  { label: "Einstellungen", href: "/settings", Icon: Settings },
  { label: "Abrechnung", href: "/billing", Icon: CreditCard },
];

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
          className="flex items-center justify-center gap-2 mb-5 mx-1 h-10 rounded-lg bg-[linear-gradient(135deg,#7C3AED_0%,#3B82F6_100%)] text-[13px] font-medium text-white shadow-[0_1px_0_rgba(255,255,255,0.16)_inset,0_6px_18px_-8px_rgba(124,58,237,0.45)] hover:brightness-110 hover:-translate-y-px transition-all duration-200"
        >
          <Sparkles className="h-3.5 w-3.5" />
          Neues Projekt
        </Link>

        <nav className="space-y-0.5">
          {primary.map(({ label, href, Icon }) => {
            const active = pathname === href || pathname.startsWith(href + "/");
            return (
              <Link
                key={href}
                href={href}
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

        <nav className="space-y-0.5">
          {secondary.map(({ label, href, Icon }) => {
            const active = pathname === href || pathname.startsWith(href + "/");
            return (
              <Link
                key={href}
                href={href}
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

      <div className="px-3 py-4 border-t border-white/[0.06]">
        <Link
          href="#"
          className="flex items-center gap-3 h-9 px-3 rounded-md text-[12.5px] text-white/55 hover:text-white hover:bg-white/[0.04] transition-colors"
        >
          <BookOpen className="h-3.5 w-3.5" strokeWidth={1.8} />
          Dokumentation
        </Link>
        <Link
          href="#"
          className="flex items-center gap-3 h-9 px-3 rounded-md text-[12.5px] text-white/55 hover:text-white hover:bg-white/[0.04] transition-colors"
        >
          <HelpCircle className="h-3.5 w-3.5" strokeWidth={1.8} />
          Hilfe
        </Link>
      </div>
    </aside>
  );
}
