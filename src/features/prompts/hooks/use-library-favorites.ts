"use client";

import "client-only";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/shared/supabase/client";
import { useToast } from "@/shared/ui/toast";
import type { LibraryItem } from "@/features/prompts/hooks/use-library-filter";

// Split out of library-browser.tsx: the favorites mutation (optimistic flip,
// Supabase write, rollback on failure, toast, sidebar refresh) is its own
// concern, independent from search/filter and from how a card renders.
export function useLibraryFavorites(items: LibraryItem[]) {
  const router = useRouter();
  const { toast } = useToast();
  const [favorites, setFavorites] = useState<Set<string>>(
    () => new Set(items.filter((i) => i.isFavorite).map((i) => i.id))
  );

  async function toggleFavorite(id: string) {
    const next = !favorites.has(id);
    // Optimistic flip, buttons must feel instant.
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
      return;
    }
    // The sidebar's pinned projects are server-rendered, without this the
    // new pin order only shows up after the next unrelated navigation.
    router.refresh();
  }

  return { favorites, toggleFavorite };
}
