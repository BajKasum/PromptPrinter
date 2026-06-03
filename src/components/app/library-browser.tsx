"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { Search, FolderKanban, Library, Star } from "lucide-react";
import { cn } from "@/lib/utils";
import { createClient } from "@/lib/supabase/client";
import { useToast } from "@/components/ui/toast";

export type LibraryItem = {
  id: string;
  name: string;
  createdLabel: string; // pre-formatted "03.06.2026"
  updatedAt: string; // ISO — used for the "Kürzlich verwendet" filter
  artifactCount: number;
  categories: string[]; // artifact category keys present in this project
  toolList: string[]; // de-duplicated tool names, e.g. ["Claude", "Lovable"]
  isFavorite: boolean;
};

const FILTERS = [
  { key: "all", label: "Alle" },
  { key: "favorites", label: "Favoriten ⭐" },
  { key: "recent", label: "Kürzlich verwendet" },
  { key: "frontend", label: "Frontend" },
  { key: "backend", label: "Backend" },
  { key: "marketing", label: "Marketing" },
  { key: "database", label: "Datenbank" },
] as const;

type FilterKey = (typeof FILTERS)[number]["key"];

const RECENT_MS = 7 * 24 * 60 * 60 * 1000;

export function LibraryBrowser({ items }: { items: LibraryItem[] }) {
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<FilterKey>("all");
  const [favorites, setFavorites] = useState<Set<string>>(
    () => new Set(items.filter((i) => i.isFavorite).map((i) => i.id))
  );
  const { toast } = useToast();

  async function toggleFavorite(id: string) {
    const next = !favorites.has(id);
    // Optimistic flip — buttons must feel instant.
    setFavorites((prev) => {
      const s = new Set(prev);
      if (next) s.add(id);
      else s.delete(id);
      return s;
    });
    const supabase = createClient();
    const { error } = await supabase
      .from("projects")
      .update({ is_favorite: next })
      .eq("id", id);
    if (error) {
      // Revert on failure so the UI never lies about persisted state.
      setFavorites((prev) => {
        const s = new Set(prev);
        if (next) s.delete(id);
        else s.add(id);
        return s;
      });
      toast({
        title: "Favorit konnte nicht gespeichert werden",
        description: "Bitte versuche es erneut.",
        variant: "error",
      });
    }
  }

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    const now = Date.now();
    return items.filter((it) => {
      if (filter === "favorites") {
        if (!favorites.has(it.id)) return false;
      } else if (filter === "recent") {
        if (now - new Date(it.updatedAt).getTime() > RECENT_MS) return false;
      } else if (filter !== "all") {
        if (!it.categories.includes(filter)) return false;
      }
      if (q) {
        const haystack = (it.name + " " + it.toolList.join(" ")).toLowerCase();
        if (!haystack.includes(q)) return false;
      }
      return true;
    });
  }, [items, query, filter, favorites]);

  return (
    <div>
      <div className="relative max-w-md mb-4">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-white/40" />
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Projekte oder Tools durchsuchen…"
          className="w-full h-10 pl-9 pr-3 rounded-lg border border-white/10 bg-white/[0.02] text-[13.5px] text-white placeholder:text-white/40 focus:outline-none focus:border-violet-500/55 focus:ring-2 focus:ring-violet-500/15"
        />
      </div>

      <div className="flex flex-wrap gap-2 mb-7">
        {FILTERS.map((f) => {
          const active = filter === f.key;
          return (
            <button
              key={f.key}
              onClick={() => setFilter(f.key)}
              className={cn(
                "text-[12.5px] px-3 py-1.5 rounded-full border transition-colors active:scale-[0.97]",
                active
                  ? "border-violet-500/40 bg-violet-500/[0.12] text-violet-100"
                  : "border-white/10 bg-white/[0.02] text-white/60 hover:text-white hover:bg-white/[0.05]"
              )}
            >
              {f.label}
            </button>
          );
        })}
      </div>

      {visible.length === 0 ? (
        <div className="card-surface p-12 text-center">
          <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-lg bg-white/[0.06] border border-white/[0.08]">
            <Library className="h-5 w-5 text-white/85" strokeWidth={1.8} />
          </div>
          <p className="text-[15px] text-white/80">Keine Treffer</p>
          <p className="mt-1.5 text-[13px] text-white/45 max-w-sm mx-auto">
            {filter === "favorites"
              ? "Du hast noch keine Favoriten markiert. Tippe auf den Stern einer Karte."
              : "Keine Artefakte passen zu dieser Auswahl. Passe Suche oder Filter an."}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
          {visible.map((it) => {
            const fav = favorites.has(it.id);
            return (
              <div
                key={it.id}
                className="card-surface relative h-full p-5 flex flex-col hover:border-white/15 transition-colors"
              >
                {/* Full-card click target; the star sits above it via z-10. */}
                <Link
                  href={`/projects/${it.id}`}
                  aria-label={`${it.name} öffnen`}
                  className="absolute inset-0 rounded-xl"
                />
                <div className="flex items-start justify-between mb-3">
                  <div className="h-9 w-9 rounded-lg bg-white/[0.06] border border-white/[0.08] flex items-center justify-center">
                    <FolderKanban className="h-4 w-4 text-white/85" strokeWidth={1.8} />
                  </div>
                  <button
                    type="button"
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      void toggleFavorite(it.id);
                    }}
                    aria-pressed={fav}
                    aria-label={fav ? "Aus Favoriten entfernen" : "Zu Favoriten hinzufügen"}
                    className="relative z-10 -mr-1 -mt-1 h-8 w-8 rounded-lg flex items-center justify-center text-white/40 hover:text-amber-300 hover:bg-white/[0.05] transition-colors active:scale-90"
                  >
                    <Star
                      className={cn(
                        "h-4 w-4 transition-colors",
                        fav && "fill-amber-300 text-amber-300"
                      )}
                      strokeWidth={1.8}
                    />
                  </button>
                </div>
                <h3 className="text-[16px] font-semibold tracking-tight text-white mb-1">
                  {it.name}
                </h3>
                <p className="text-[12.5px] text-white/45">
                  Erstellt: {it.createdLabel} · {it.artifactCount}{" "}
                  {it.artifactCount === 1 ? "Artefakt" : "Artefakte"}
                </p>
                {it.toolList.length > 0 && (
                  <div className="mt-auto flex flex-wrap gap-1.5 pt-4">
                    {it.toolList.map((t) => (
                      <span
                        key={t}
                        className="text-[10.5px] font-mono px-1.5 py-0.5 rounded bg-white/[0.04] border border-white/[0.06] text-white/65"
                      >
                        {t}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
