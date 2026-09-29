"use client";

import "client-only";

import { useCallback, useTransition } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/shared/supabase/client";
import { LOCALE_COOKIE, type Locale } from "@/shared/i18n/locales";

/**
 * Die Sprachwahl, geteilt von Kontomenü, Mobile-Drawer und Einstellungen.
 *
 * Zwei Orte, zwei Aufgaben:
 * - der Cookie `pp-locale` sagt jedem folgenden Request sofort, in welcher
 *   Sprache gerendert wird, ohne Datenbankabfrage;
 * - `profiles.settings.locale` nimmt die Wahl auf andere Geräte mit (dort
 *   liest das (app)-Layout sie, solange noch kein Cookie existiert).
 *
 * Der Profil-Schreibzugriff ist bewusst "best effort": der Cookie ist schon
 * gesetzt, die App wechselt also auch dann die Sprache, wenn die Zeile
 * gerade nicht geschrieben werden kann. Danach rendert router.refresh() die
 * Server-Komponenten in der neuen Sprache neu, ohne die Seite zu verlassen
 * (ein offener Chat samt Entwurf im Eingabefeld bleibt stehen).
 */
export function useChangeLocale() {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  const change = useCallback(
    async (next: Locale) => {
      document.cookie = `${LOCALE_COOKIE}=${next}; path=/; max-age=31536000; samesite=lax`;
      try {
        const supabase = createClient();
        const {
          data: { user },
        } = await supabase.auth.getUser();
        if (user) {
          // settings ist eine JSONB-Spalte mit weiteren Schlüsseln (z. B.
          // interested_in), also lesen, zusammenführen, zurückschreiben.
          const { data } = await supabase
            .from("profiles")
            .select("settings")
            .eq("id", user.id)
            .maybeSingle();
          const current =
            data?.settings && typeof data.settings === "object" && !Array.isArray(data.settings)
              ? (data.settings as Record<string, unknown>)
              : {};
          await supabase
            .from("profiles")
            .update({ settings: { ...current, locale: next } })
            .eq("id", user.id);
        }
      } catch {
        // Siehe oben: der Cookie trägt die Wahl für dieses Gerät ohnehin.
      }
      startTransition(() => router.refresh());
    },
    [router]
  );

  return { change, pending };
}
