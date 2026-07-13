"use client";

import { useEffect, useMemo, useState } from "react";

// Split out of library-browser.tsx: search, filter, and pagination are one
// self-contained concern (derive `visible` from items + query + filter +
// favorites, then window it) — independent from the favorites mutation and
// from how a single result renders.

export type LibraryItem = {
  id: string;
  name: string;
  updatedAt: string; // ISO — drives the "Kürzlich verwendet" filter + the footer's relative time
  artifactCount: number;
  chatCount: number; // conversations living inside this workspace
  categories: string[]; // artifact category keys present in this project
  toolList: string[]; // de-duplicated tool names, e.g. ["Claude", "Lovable"]
  isFavorite: boolean;
};

export const FILTERS = [
  { key: "all", label: "Alle" },
  { key: "favorites", label: "Favoriten" },
  { key: "recent", label: "Kürzlich verwendet" },
  { key: "frontend", label: "Frontend" },
  { key: "backend", label: "Backend" },
  { key: "marketing", label: "Marketing" },
  { key: "database", label: "Datenbank" },
] as const;

export type FilterKey = (typeof FILTERS)[number]["key"];

const RECENT_MS = 7 * 24 * 60 * 60 * 1000;

// Projects load in one server-side shot (no server-side pagination yet — the
// list is one row per project, not per generation, so it stays small for a
// long time). This just caps how much of it renders as DOM at once, so the
// page doesn't start paying render cost as project counts grow into the
// hundreds. Bump/replace with real server pagination if that day ever comes.
const PAGE_SIZE = 24;

export function useLibraryFilter(items: LibraryItem[], favorites: Set<string>) {
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<FilterKey>("all");
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);

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

  // A changed search/filter invalidates whatever page you'd scrolled to —
  // land back on the first page of the new result set instead of showing an
  // arbitrary slice (or nothing, if the new set is shorter than the old offset).
  useEffect(() => {
    setVisibleCount(PAGE_SIZE);
  }, [query, filter]);

  const visiblePage = visible.slice(0, visibleCount);

  return {
    query,
    setQuery,
    filter,
    setFilter,
    visiblePage,
    visibleTotal: visible.length,
    hasMore: visible.length > visibleCount,
    loadMore: () => setVisibleCount((c) => c + PAGE_SIZE),
  };
}
