"use client";

import Link from "next/link";
import { FolderKanban, Sparkles, Clock, Star } from "lucide-react";
import { cn, relativeTime } from "@/lib/utils";
import type { LibraryItem } from "@/lib/use-library-filter";

// Split out of library-browser.tsx: purely presentational, one project's
// card, agnostic to how the list was filtered or how favorites are persisted.

// What lives in this workspace, compact: "2 Chats · 10 Artefakte". A project
// without either is simply young, not defective.
function workspaceMeta(it: LibraryItem): string {
  const parts = [
    it.chatCount > 0 ? `${it.chatCount} ${it.chatCount === 1 ? "Chat" : "Chats"}` : null,
    it.artifactCount > 0
      ? `${it.artifactCount} ${it.artifactCount === 1 ? "Artefakt" : "Artefakte"}`
      : null,
  ].filter(Boolean);
  return parts.length > 0 ? parts.join(" · ") : "Frisch angelegt";
}

export function LibraryCard({
  item,
  isFavorite,
  onToggleFavorite,
}: {
  item: LibraryItem;
  isFavorite: boolean;
  onToggleFavorite: () => void;
}) {
  return (
    <div className="card-surface relative h-full p-5 flex flex-col hover:border-border-strong transition-colors">
      {/* Full-card click target; the star sits above it via z-10. */}
      <Link
        href={`/projects/${item.id}`}
        aria-label={`${item.name} öffnen`}
        className="absolute inset-0 rounded-xl"
      />
      <div className="flex items-start justify-between mb-3">
        <div className="h-9 w-9 rounded-lg bg-surface border border-border flex items-center justify-center">
          <FolderKanban className="h-4 w-4 text-foreground" strokeWidth={1.8} />
        </div>
        <button
          type="button"
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            onToggleFavorite();
          }}
          aria-pressed={isFavorite}
          aria-label={isFavorite ? "Aus Favoriten entfernen" : "Zu Favoriten hinzufügen"}
          className="relative z-10 -mr-1 -mt-1 h-8 w-8 rounded-lg flex items-center justify-center text-foreground/40 hover:text-amber-300 hover:bg-surface-hover transition-colors active:scale-90"
        >
          <Star
            className={cn(
              "h-4 w-4 transition-colors",
              isFavorite && "fill-amber-300 text-amber-300"
            )}
            strokeWidth={1.8}
          />
        </button>
      </div>

      {/* Name leads, this is a workspace you enter, not a record. */}
      <h3 className="text-[16px] font-semibold tracking-tight text-foreground mb-2 line-clamp-1">
        {item.name}
      </h3>

      {/* What's inside, category pills as the project's content areas. */}
      {item.categories.length > 0 && (
        <div className="flex flex-wrap gap-1.5 mb-4">
          {item.categories.map((c) => (
            <span
              key={c}
              className="text-[10.5px] px-2 py-0.5 rounded-full border border-accent/25 bg-accent-subtle text-accent-text"
            >
              {c}
            </span>
          ))}
        </div>
      )}

      {/* Workspace-Meta + freshness, supporting metadata in the footer:
          what lives inside (chats, results), not just artifacts. */}
      <div className="mt-auto flex items-center justify-between text-[11.5px] text-muted-foreground pt-3 border-t border-border">
        <span className="inline-flex items-center gap-1.5">
          <Sparkles className="h-3 w-3" />
          {workspaceMeta(item)}
        </span>
        <span className="inline-flex items-center gap-1.5">
          <Clock className="h-3 w-3" />
          {relativeTime(item.updatedAt)}
        </span>
      </div>
    </div>
  );
}
