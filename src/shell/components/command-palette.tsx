"use client";

import { Fragment, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Search,
  FolderKanban,
  MessageSquare,
  CornerDownLeft,
  type LucideIcon,
} from "lucide-react";
import { cn } from "@/shared/lib/utils";
import { Dialog } from "@/shared/ui/dialog";
import { createClient } from "@/shared/supabase/client";
import { captureError } from "@/shared/lib/observability";
import { primaryNav, secondaryNav } from "@/shell/lib/nav";
import { formatShortcut, isMacPlatform, type Shortcut } from "@/shell/lib/shortcuts";
import { LIST_LOAD_LIMIT } from "@/shared/lib/chat-limits";
import { useT } from "@/shared/i18n/provider";
import { fmt } from "@/shared/i18n/format";

type Cmd = {
  id: string;
  label: string;
  group: string;
  Icon: LucideIcon;
  perform: () => void;
  /** Das globale Kürzel dieser Seite, falls sie eins hat (shell/lib/nav.ts). */
  shortcut?: Shortcut;
};

export function CommandPalette({ open, onClose }: { open: boolean; onClose: () => void }) {
  const t = useT();
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [query, setQuery] = useState("");
  // Die gewählte Zeile. `null` heisst: nichts gewählt, es gilt der erste Treffer.
  const [activeId, setActiveId] = useState<string | null>(null);
  const rowRefs = useRef<(HTMLButtonElement | null)[]>([]);
  const [projects, setProjects] = useState<{ id: string; name: string }[]>([]);
  const [chats, setChats] = useState<{ id: string; title: string; project_id: string | null }[]>(
    []
  );
  // Beim Schliessen ohne Ziel (Escape, Klick daneben, Strg+K) gibt der Dialog den Fokus an das Element zurück, das
  // ihn vorher hatte. Beim Wechsel auf eine Seite nicht: dort übernimmt die neue Seite den Fokus.
  const navigatingRef = useRef(false);

  const go = useCallback(
    (href: string) => {
      navigatingRef.current = true;
      onClose();
      router.push(href);
    },
    [onClose, router]
  );

  // Reset transient state each time the palette opens.
  useEffect(() => {
    if (!open) return;
    navigatingRef.current = false;
    setQuery("");
    setActiveId(null);
  }, [open]);

  // Chats und Projekte bei jedem Öffnen neu lesen: die Palette bleibt über Seitenwechsel gemountet, ein einmal
  // geladener Stand kennt nichts, was danach angelegt, umbenannt oder gelöscht wurde. Die vorige Liste bleibt
  // stehen, bis die neue da ist, nach einem Lesefehler auch darüber hinaus; die Seiten-Befehle brauchen keine.
  // LIST_LOAD_LIMIT teilen sich die Palette und die Listenseiten: die verweisen für Älteres auf ⌘K.
  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    (async () => {
      const supabase = createClient();
      const [
        { data: projectRows, error: projectsError },
        { data: chatRows, error: chatsError },
      ] = await Promise.all([
        supabase
          .from("projects")
          .select("id, name")
          .order("updated_at", { ascending: false })
          .limit(LIST_LOAD_LIMIT),
        supabase
          .from("conversations")
          .select("id, title, project_id")
          .order("updated_at", { ascending: false })
          .limit(LIST_LOAD_LIMIT),
      ]);
      if (cancelled) return;
      // Bei einem Fehler ist `data` null.
      if (projectRows) setProjects(projectRows);
      if (chatRows) setChats(chatRows);
      const failure = projectsError ?? chatsError;
      if (failure) captureError("palette.load_failed", failure);
    })();
    return () => {
      cancelled = true;
    };
  }, [open]);

  // Derive the page commands from the same nav source the sidebar + mobile drawer
  // use, so the palette can never drift out of sync (labels, icons, presence).
  const navCommands = useMemo<Cmd[]>(() => {
    const pages: Cmd[] = [...primaryNav, ...secondaryNav].map((n) => ({
      id: n.href,
      label: t.nav[n.labelKey],
      group: t.palette.groupPages,
      Icon: n.Icon,
      perform: () => go(n.href),
      shortcut: n.shortcut,
    }));
    // One entry point, not two: there is only one chat (REDESIGN.md, Phase 2).
    const actions: Cmd[] = [
      {
        id: "new-chat",
        label: t.nav.newChat,
        group: t.palette.groupActions,
        Icon: MessageSquare,
        perform: () => go("/chats/new"),
      },
    ];
    return [...pages, ...actions];
  }, [go, t]);

  const results = useMemo<Cmd[]>(() => {
    const chatCommands: Cmd[] = chats.map((c) => ({
      id: `chat-${c.id}`,
      label: c.title,
      group: t.palette.groupChats,
      Icon: MessageSquare,
      // A project chat lives at its workspace's own route, not /chats/[id].
      perform: () =>
        go(c.project_id ? `/projects/${c.project_id}/chats/${c.id}` : `/chats/${c.id}`),
    }));
    const projectCommands: Cmd[] = projects.map((p) => ({
      id: `project-${p.id}`,
      label: p.name,
      group: t.palette.groupProjects,
      Icon: FolderKanban,
      perform: () => go(`/projects/${p.id}`),
    }));
    const all = [...navCommands, ...chatCommands, ...projectCommands];
    const q = query.trim().toLowerCase();
    if (!q) return all;
    return all.filter((c) => c.label.toLowerCase().includes(q));
  }, [navCommands, chats, projects, query, go, t]);

  // Die Markierung hängt am Eintrag, nicht an der Zeilennummer: kommt die frisch gelesene Liste an, bleibt sie
  // auf demselben Ziel. Ohne Wahl, oder wenn der Eintrag nicht mehr dabei ist, gilt der erste Treffer.
  const activeIndex = Math.max(
    results.findIndex((c) => c.id === activeId),
    0
  );

  // Die Liste rollt der Markierung nach, auch nach einer Sucheingabe in einer gerollten Liste. "nearest" tut
  // nichts, solange die Zeile ganz sichtbar ist, etwa unter dem Mauszeiger.
  useEffect(() => {
    rowRefs.current[activeIndex]?.scrollIntoView({ block: "nearest" });
  }, [activeIndex, query]);

  // Ein Schritt mit den Pfeiltasten, an beiden Enden geklemmt. Ohne Treffer bleibt nichts gewählt.
  function move(step: 1 | -1) {
    const index = Math.min(Math.max(activeIndex + step, 0), results.length - 1);
    setActiveId(results[index]?.id ?? null);
  }

  function onKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      move(1);
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      move(-1);
    } else if (e.key === "Enter") {
      e.preventDefault();
      results[activeIndex]?.perform();
    }
  }

  // Die Zeilen stehen erst nach dem Mount im Baum (Dialog), also ohne Hydration-Risiko.
  const mac = isMacPlatform();

  return (
    <Dialog
      open={open}
      onClose={onClose}
      label={t.palette.dialog}
      placement="top"
      initialFocusRef={inputRef}
      returnFocus={() => !navigatingRef.current}
    >
      <div className="flex items-center gap-3 border-b border-border px-4">
        <Search className="h-4 w-4 shrink-0 text-muted-foreground" />
        <input
          ref={inputRef}
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setActiveId(null);
          }}
          onKeyDown={onKeyDown}
          placeholder={t.palette.placeholder}
          aria-label={t.palette.input}
          className="h-12 w-full bg-transparent text-[14px] text-foreground placeholder:text-muted-foreground focus:outline-hidden"
        />
      </div>

      <div className="max-h-[340px] overflow-y-auto p-1.5">
        {results.length === 0 ? (
          <div className="px-3 py-8 text-center text-[13px] text-muted-foreground">
            {fmt(t.palette.noResults, { query })}
          </div>
        ) : (
          results.map((c, i) => {
            const showHeader = i === 0 || results[i - 1].group !== c.group;
            const active = i === activeIndex;
            return (
              <Fragment key={c.id}>
                {showHeader && (
                  <div className="px-3 pb-1 pt-3 text-[12px] font-mono uppercase tracking-[0.08em] text-muted-foreground">
                    {c.group}
                  </div>
                )}
                <button
                  ref={(el) => {
                    rowRefs.current[i] = el;
                  }}
                  type="button"
                  data-active={active}
                  // Nur eine bewegte Maus wählt: rutscht beim Tippen eine andere Zeile unter den ruhenden
                  // Zeiger, bleibt die Markierung auf dem ersten Treffer.
                  onMouseMove={() => setActiveId(c.id)}
                  onClick={() => c.perform()}
                  className={cn(
                    "flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left text-[13.5px] transition-colors",
                    // Kein eigener Hover-Stil: unter einem ruhenden Zeiger stünde sonst eine zweite Markierung.
                    active ? "bg-accent-subtle text-accent-text" : "text-foreground/70"
                  )}
                >
                  <c.Icon
                    className={cn("h-4 w-4 shrink-0", active ? "text-accent-text" : "text-foreground/70")}
                    strokeWidth={1.8}
                  />
                  <span className="flex-1 truncate">{c.label}</span>
                  {/* Die Palette ist der Ort, an dem man Kürzel lernt:
                      wer hier "Einstellungen" sucht, sieht nebenbei,
                      dass es auch ohne Palette geht. */}
                  {c.shortcut && (
                    <kbd
                      aria-hidden
                      className={cn(
                        "shrink-0 font-sans text-[12px] tabular-nums tracking-wide",
                        active ? "text-accent-text" : "text-tertiary"
                      )}
                    >
                      {formatShortcut(c.shortcut, mac, t.shell.ctrlKey)}
                    </kbd>
                  )}
                  {active && <CornerDownLeft className="h-3.5 w-3.5 shrink-0 text-accent-text" />}
                </button>
              </Fragment>
            );
          })
        )}
      </div>

      <div className="flex items-center justify-between gap-3 border-t border-border px-4 py-2.5 text-[12px] text-muted-foreground">
        <span className="flex items-center gap-3">
          <span className="flex items-center gap-1">
            <kbd className="rounded border border-border bg-surface px-1.5 py-0.5">↑</kbd>
            <kbd className="rounded border border-border bg-surface px-1.5 py-0.5">↓</kbd>
            {t.palette.navigate}
          </span>
          <span className="flex items-center gap-1">
            <kbd className="rounded border border-border bg-surface px-1.5 py-0.5">↵</kbd>
            {t.palette.open}
          </span>
        </span>
        <span className="flex items-center gap-1">
          <kbd className="rounded border border-border bg-surface px-1.5 py-0.5">esc</kbd>
          {t.palette.close}
        </span>
      </div>
    </Dialog>
  );
}
