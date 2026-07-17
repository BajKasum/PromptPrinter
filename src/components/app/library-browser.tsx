"use client";

import { Search, Library } from "lucide-react";
import { cn } from "@/lib/utils";
import { useLibraryFavorites } from "@/lib/use-library-favorites";
import { useLibraryFilter, FILTERS, type LibraryItem } from "@/lib/use-library-filter";
import { LibraryCard } from "@/components/app/library-card";

export type { LibraryItem };

// Orchestrator only, search/filter/pagination lives in useLibraryFilter, the
// favorites mutation lives in useLibraryFavorites, and a single result's
// presentation lives in LibraryCard. This component just composes them.
export function LibraryBrowser({ items }: { items: LibraryItem[] }) {
  const { favorites, toggleFavorite } = useLibraryFavorites(items);
  const { query, setQuery, filter, setFilter, visiblePage, visibleTotal, hasMore, loadMore } =
    useLibraryFilter(items, favorites);

  return (
    <div>
      <div className="relative max-w-md mb-4">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-foreground/40" />
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Projekte oder Tools durchsuchen…"
          className="w-full h-10 pl-9 pr-3 rounded-lg border border-border bg-surface text-[13.5px] text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-ring focus:ring-2 focus:ring-ring/20"
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
                  ? "border-accent/40 bg-accent-subtle text-accent-text"
                  : "border-border bg-surface text-foreground/60 hover:text-foreground hover:bg-surface-hover"
              )}
            >
              {f.label}
            </button>
          );
        })}
      </div>

      {visibleTotal === 0 ? (
        <div className="card-surface p-12 text-center">
          <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-lg bg-surface border border-border">
            <Library className="h-5 w-5 text-foreground/85" strokeWidth={1.8} />
          </div>
          <p className="text-[15px] text-foreground/80">Keine Treffer</p>
          <p className="mt-1.5 text-[13px] text-foreground/45 max-w-sm mx-auto">
            {filter === "favorites"
              ? "Du hast noch keine Favoriten markiert. Tippe auf den Stern einer Karte."
              : "Keine Projekte passen zu dieser Auswahl. Passe Suche oder Filter an."}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
          {visiblePage.map((it) => (
            <LibraryCard
              key={it.id}
              item={it}
              isFavorite={favorites.has(it.id)}
              onToggleFavorite={() => void toggleFavorite(it.id)}
            />
          ))}
        </div>
      )}

      {hasMore && (
        <div className="mt-6 flex justify-center">
          <button
            type="button"
            onClick={loadMore}
            className="text-[13px] px-4 py-2 rounded-lg border border-border bg-surface text-foreground/70 hover:text-foreground hover:bg-surface-hover transition-colors active:scale-[0.98]"
          >
            {visiblePage.length} von {visibleTotal}, mehr laden
          </button>
        </div>
      )}
    </div>
  );
}
