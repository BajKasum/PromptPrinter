"use client";

import { Fragment, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { createPortal } from "react-dom";
import { AnimatePresence, motion } from "framer-motion";
import {
  Search,
  LayoutDashboard,
  FolderKanban,
  Library,
  Sparkles,
  MessageSquare,
  Code2,
  Settings,
  CreditCard,
  CornerDownLeft,
  type LucideIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { createClient } from "@/lib/supabase/client";

type Cmd = { id: string; label: string; group: string; Icon: LucideIcon; perform: () => void };

export function CommandPalette({ open, onClose }: { open: boolean; onClose: () => void }) {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [mounted, setMounted] = useState(false);
  const [query, setQuery] = useState("");
  const [activeIndex, setActiveIndex] = useState(0);
  const [projects, setProjects] = useState<{ id: string; name: string }[]>([]);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => setMounted(true), []);

  const go = useCallback(
    (href: string) => {
      onClose();
      router.push(href);
    },
    [onClose, router]
  );

  // Reset transient state each time the palette opens, and focus the input.
  useEffect(() => {
    if (!open) return;
    setQuery("");
    setActiveIndex(0);
    const t = window.setTimeout(() => inputRef.current?.focus(), 20);
    return () => window.clearTimeout(t);
  }, [open]);

  // Lazily load the user's projects the first time the palette opens.
  useEffect(() => {
    if (!open || loaded) return;
    let cancelled = false;
    (async () => {
      const supabase = createClient();
      const { data } = await supabase
        .from("projects")
        .select("id, name")
        .order("updated_at", { ascending: false })
        .limit(50);
      if (!cancelled) {
        setProjects(data ?? []);
        setLoaded(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [open, loaded]);

  const navCommands = useMemo<Cmd[]>(
    () => [
      { id: "dashboard", label: "Dashboard", group: "Seiten", Icon: LayoutDashboard, perform: () => go("/dashboard") },
      { id: "projects", label: "Projekte", group: "Seiten", Icon: FolderKanban, perform: () => go("/projects") },
      { id: "library", label: "Bibliothek", group: "Seiten", Icon: Library, perform: () => go("/library") },
      { id: "generations", label: "Generierungen", group: "Seiten", Icon: Sparkles, perform: () => go("/generations") },
      { id: "settings", label: "Einstellungen", group: "Seiten", Icon: Settings, perform: () => go("/settings") },
      { id: "billing", label: "Abrechnung", group: "Seiten", Icon: CreditCard, perform: () => go("/billing") },
      { id: "chat-general", label: "Prompt Chat starten", group: "Aktionen", Icon: MessageSquare, perform: () => go("/chat?mode=general") },
      { id: "chat-software", label: "Prompt Code starten", group: "Aktionen", Icon: Code2, perform: () => go("/chat?mode=software") },
    ],
    [go]
  );

  const results = useMemo<Cmd[]>(() => {
    const projectCommands: Cmd[] = projects.map((p) => ({
      id: `project-${p.id}`,
      label: p.name,
      group: "Projekte",
      Icon: FolderKanban,
      perform: () => go(`/projects/${p.id}`),
    }));
    const all = [...navCommands, ...projectCommands];
    const q = query.trim().toLowerCase();
    if (!q) return all;
    return all.filter((c) => c.label.toLowerCase().includes(q));
  }, [navCommands, projects, query, go]);

  // Keep the highlighted row valid as the result set shrinks/grows.
  useEffect(() => {
    setActiveIndex((i) => Math.min(i, Math.max(results.length - 1, 0)));
  }, [results.length]);

  function onKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActiveIndex((p) => Math.min(p + 1, results.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActiveIndex((p) => Math.max(p - 1, 0));
    } else if (e.key === "Enter") {
      e.preventDefault();
      results[activeIndex]?.perform();
    } else if (e.key === "Escape") {
      e.preventDefault();
      onClose();
    }
  }

  if (!mounted) return null;

  return createPortal(
    <AnimatePresence>
      {open && (
        <motion.div
          className="fixed inset-0 z-[90] flex justify-center bg-black/60 px-4 pt-[12vh] backdrop-blur-sm"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.15 }}
          onMouseDown={onClose}
        >
          <motion.div
            role="dialog"
            aria-modal="true"
            aria-label="Befehls-Palette"
            initial={{ opacity: 0, scale: 0.98, y: -8 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.98, y: -8 }}
            transition={{ duration: 0.16, ease: [0.16, 1, 0.3, 1] }}
            onMouseDown={(e) => e.stopPropagation()}
            className="h-fit w-full max-w-xl overflow-hidden rounded-xl border border-white/10 bg-[#111113] shadow-[0_24px_70px_-20px_rgba(0,0,0,0.8)]"
          >
            <div className="flex items-center gap-3 border-b border-white/[0.06] px-4">
              <Search className="h-4 w-4 shrink-0 text-white/40" />
              <input
                ref={inputRef}
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onKeyDown={onKeyDown}
                placeholder="Projekte, Seiten, Aktionen…"
                aria-label="Befehl oder Projekt suchen"
                className="h-12 w-full bg-transparent text-[14px] text-white placeholder:text-white/40 focus:outline-none"
              />
            </div>

            <div className="max-h-[340px] overflow-y-auto p-1.5">
              {results.length === 0 ? (
                <div className="px-3 py-8 text-center text-[13px] text-white/45">
                  Keine Treffer für „{query}“
                </div>
              ) : (
                results.map((c, i) => {
                  const showHeader = i === 0 || results[i - 1].group !== c.group;
                  const active = i === activeIndex;
                  return (
                    <Fragment key={c.id}>
                      {showHeader && (
                        <div className="px-3 pb-1 pt-3 text-[10px] font-mono uppercase tracking-[0.08em] text-white/35">
                          {c.group}
                        </div>
                      )}
                      <button
                        type="button"
                        onMouseEnter={() => setActiveIndex(i)}
                        onClick={() => c.perform()}
                        className={cn(
                          "flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left text-[13.5px] transition-colors",
                          active ? "bg-white/[0.06] text-white" : "text-white/70"
                        )}
                      >
                        <c.Icon className="h-4 w-4 shrink-0 text-white/55" strokeWidth={1.8} />
                        <span className="flex-1 truncate">{c.label}</span>
                        {active && <CornerDownLeft className="h-3.5 w-3.5 shrink-0 text-white/40" />}
                      </button>
                    </Fragment>
                  );
                })
              )}
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>,
    document.body
  );
}
