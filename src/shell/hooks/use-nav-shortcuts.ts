"use client";

import "client-only";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { secondaryNav } from "@/shell/lib/nav";
import { matchesShortcut } from "@/shell/lib/shortcuts";

// Globaler Listener für die Kontomenü-Kürzel (Strg/⌘ + Komma usw.), die
// Definition steht in shell/lib/nav.ts bzw. shortcuts.ts. Läuft auch, während
// der Fokus im Chat-Eingabefeld liegt: keines der Kürzel erzeugt Text, und
// genau dort sitzt man meistens, wenn man schnell in die Einstellungen will.
export function useNavShortcuts() {
  const router = useRouter();

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      // Gedrückt gehalten feuert keydown wiederholt; eine Navigation genügt.
      // isComposing: mitten in einer IME-Eingabe (z. B. Japanisch) gehört die
      // Taste der Eingabemethode, nicht uns.
      if (e.repeat || e.isComposing) return;
      for (const item of secondaryNav) {
        if (item.shortcut && matchesShortcut(e, item.shortcut)) {
          e.preventDefault();
          router.push(item.href);
          return;
        }
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [router]);
}
