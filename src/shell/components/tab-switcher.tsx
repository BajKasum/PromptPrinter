"use client";

import Link from "next/link";
import { primaryNav, type NavItem } from "@/shell/lib/nav";
import { cn } from "@/shared/lib/utils";
import { useT } from "@/shared/i18n/provider";

// Pill switcher between the sidebar's two destinations. Each pill is a real
// link (not a client-only toggle), so `tab` above and the URL can never
// drift apart. Labels are deliberately singular ("Chat"/"Projekt") to match
// this switcher specifically, everywhere else in the app still says the
// plural "Chats"/"Projekte" (primaryNav, page titles, command palette).
// Exported so the mobile drawer uses the exact same switcher, not a copy.
export function TabSwitcher({ tab }: { tab: "chats" | "projects" }) {
  const t = useT();
  return (
    <div className="mb-4 flex items-center gap-1 rounded-lg border border-border bg-surface p-1">
      <TabPill
        href={primaryNav[0].href}
        active={tab === "chats"}
        Icon={primaryNav[0].Icon}
        label={t.nav.chatTab}
      />
      <TabPill
        href={primaryNav[1].href}
        active={tab === "projects"}
        Icon={primaryNav[1].Icon}
        label={t.nav.projectTab}
      />
    </div>
  );
}

// M-15 (Audit 06.09.2026): der inaktive Zustand stand vorher auf einer
// Alpha-Stufe (/70) auf muted-foreground, einem Ton, der schon bei voller
// Deckkraft nur knapp über der AA-Schwelle liegt (im Light Mode 5,4:1 auf
// background, 4,9:1 auf der ungünstigeren surface), fällt bei /70 auf rund
// 2,9:1. `text-secondary` ist die dafür kalibrierte Stufe.
function TabPill({
  href,
  active,
  Icon,
  label,
}: {
  href: string;
  active: boolean;
  Icon: NavItem["Icon"];
  label: string;
}) {
  return (
    <Link
      href={href}
      aria-current={active ? "page" : undefined}
      className={cn(
        "flex flex-1 items-center justify-center gap-1.5 rounded-md py-1.5 text-[12.5px] font-medium transition-colors",
        active
          ? "bg-surface-raised text-foreground shadow-sm"
          : "text-secondary hover:text-foreground"
      )}
    >
      <Icon className="h-3.5 w-3.5" strokeWidth={2} />
      {label}
    </Link>
  );
}
