"use client";

import { Star } from "lucide-react";
import { HoverPrefetchLink } from "@/shared/ui/hover-prefetch-link";
import { cn } from "@/shared/lib/utils";
import { useT } from "@/shared/i18n/provider";

// Die Chat- und die Projektliste der App-Navigation, einmal für Sidebar und Mobile-Drawer. Hier steht, wann eine
// Zeile als aktiv gilt und wie sie aussieht; die beiden Ansichten geben nur Zeilenhöhe, Schriftgrösse und das
// Schliessen vor.

export type SidebarChat = { id: string; title: string };
export type SidebarProject = { id: string; name: string; isFavorite: boolean };

// Die Zeilensprache auch für die übrigen Links im Drawer: Akzentstrich, Gewicht und eine leichte Tönung, denn der
// Strich allein geht beim Überfliegen einer langen Liste unter. Dieselbe Tönung trägt die eingeklappte Leiste.
export const ACTIVE_ROW =
  "relative rounded-md bg-accent-subtle font-medium text-foreground before:absolute before:inset-y-[6px] before:left-0 before:w-[3px] before:rounded-full before:bg-accent before:content-['']";
export const INACTIVE_ROW = "text-foreground/70 hover:bg-surface-hover hover:text-foreground";

/** Welche der beiden Listen zu sehen ist. Sie folgt der Adresse; alles ausserhalb von Projekten zeigt die Chats. */
export function navTab(pathname: string): "chats" | "projects" {
  return pathname === "/projects" || pathname.startsWith("/projects/") ? "projects" : "chats";
}

type ListProps = {
  pathname: string;
  /** Zeilenhöhe und Schriftgrösse der Ansicht. */
  rowClassName: string;
  /** Beim Antippen einer Zeile, etwa um den Drawer zu schliessen. */
  onNavigate?: () => void;
};

function EmptyHint({ children }: { children: string }) {
  return <p className="px-3 py-1.5 text-[12px] leading-relaxed text-tertiary">{children}</p>;
}

export function ChatNavList({ items, pathname, rowClassName, onNavigate }: ListProps & { items: SidebarChat[] }) {
  const t = useT();
  if (items.length === 0) return <EmptyHint>{t.shell.firstChatHint}</EmptyHint>;

  return items.map((c) => {
    const active = pathname === `/chats/${c.id}`;
    return (
      <HoverPrefetchLink
        key={c.id}
        href={`/chats/${c.id}`}
        onClick={onNavigate}
        title={c.title}
        aria-current={active ? "page" : undefined}
        className={cn(
          "block truncate rounded-md pl-3.5 pr-3 transition-colors",
          rowClassName,
          active ? ACTIVE_ROW : INACTIVE_ROW
        )}
      >
        {c.title}
      </HoverPrefetchLink>
    );
  });
}

export function ProjectNavList({
  items,
  pathname,
  rowClassName,
  onNavigate,
}: ListProps & { items: SidebarProject[] }) {
  const t = useT();
  if (items.length === 0) return <EmptyHint>{t.shell.noProjectsHint}</EmptyHint>;

  return items.map((p) => {
    // Unterseiten (Chats, Ergebnisse) gehören zum selben Projekt.
    const active = pathname === `/projects/${p.id}` || pathname.startsWith(`/projects/${p.id}/`);
    return (
      <HoverPrefetchLink
        key={p.id}
        href={`/projects/${p.id}`}
        onClick={onNavigate}
        title={p.name}
        aria-current={active ? "page" : undefined}
        className={cn(
          "flex items-center gap-2 rounded-md pl-3.5 pr-3 transition-colors",
          rowClassName,
          active ? ACTIVE_ROW : INACTIVE_ROW
        )}
      >
        <span className="min-w-0 flex-1 truncate">{p.name}</span>
        {p.isFavorite && (
          <Star aria-label={t.shell.pinned} className="h-3 w-3 shrink-0 fill-current text-accent-text/70" />
        )}
      </HoverPrefetchLink>
    );
  });
}
