import "server-only";

import { cache } from "react";
import type { User } from "@supabase/supabase-js";
import { createClient } from "@/server/supabase/server";

// Die eine Stelle, die pro Request nach dem angemeldeten Nutzer und seinem
// Profil fragt (Planpunkt B-3).
//
// ─── Was das Problem war ───────────────────────────────────────────────────
// Ein einziger Aufruf einer Projekt-Chat-Seite lief ueber vier Ebenen, die
// alle dasselbe erneut holten:
//
//   Middleware          1x getUser()
//   (app)/layout        1x getUser() + profiles + conversations + projects
//   (workspace)/layout  getProject() (1x getUser() + 1 Query) + 4 Queries
//   chats/[cid]/page    1x getUser() + profiles(display_name) + 3 Queries
//
// Rund 15 Rundreisen, davon vier redundante getUser() und ein doppelt
// geholtes profiles.display_name. Die Ebenen selbst sind zwangslaeufig
// nacheinander — innerhalb einer Ebene laeuft schon alles parallel, das ist
// sauber gebaut. Es lief nur zu oft, und jede Rundreise ging bis vor kurzem
// ueber den Atlantik (siehe B-1).
//
// ─── Warum React `cache()` und nicht ein eigener Speicher ──────────────────
// `cache()` ist genau dafuer da und **pro Request** begrenzt: React legt den
// Speicher am Request-Kontext an, nicht am Modul. Zwei gleichzeitige Anfragen
// zweier Nutzer teilen sich also nichts — die naheliegende Sorge bei einem
// Cache um Auth-Daten, und der Grund, warum hier KEINE Map auf Modulebene
// steht. Ein Modul-Cache waere in einer Server-Umgebung prozessweit und damit
// genau der teure Fehler.
//
// Bewusst NICHT in den API-Routen eingesetzt: die tragen die Kosten- und
// Limit-Pruefungen, dort ist der Auth-Aufruf ohnehin einmalig, und ein
// Verhaltenswechsel auf dem heissesten Pfad des Produkts bringt dort nichts.

/** Alles, was irgendeine Seite vom Profil braucht — als eine Abfrage. */
export type SessionProfile = {
  plan: string | null;
  is_admin: boolean | null;
  display_name: string | null;
  avatar_url: string | null;
  settings: unknown;
};

/**
 * Der angemeldete Nutzer, hoechstens einmal pro Request geholt.
 *
 * Gibt `null` zurueck statt zu werfen: die Aufrufer entscheiden selbst, ob
 * das ein `redirect("/login")` (Layouts), ein 404 oder ein stiller Leerlauf
 * ist. Das war vorher auch schon so, nur eben je Aufrufstelle neu geholt.
 */
export const getSessionUser = cache(async (): Promise<User | null> => {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return user;
});

/**
 * Das Profil des angemeldeten Nutzers, hoechstens einmal pro Request.
 *
 * Holt bewusst die Vereinigungsmenge aller Spalten, die irgendeine Seite
 * braucht (`plan`/`is_admin` fuer Limits, `display_name`/`avatar_url` fuer die
 * Anzeige, `settings` fuer die Onboarding-Tour). Es ist genau eine Zeile;
 * zwei Abfragen mit je zwei Spalten kosten mehr als eine mit fuenf, sobald
 * sie auf verschiedenen Render-Ebenen liegen und deshalb nacheinander laufen.
 *
 * RLS grenzt auf den Eigentuemer ein, das explizite `.eq("id", …)` ist die
 * zweite Linie (CLAUDE.mds Defense-in-depth-Regel). `profiles.id` IST die
 * User-ID, deshalb hier kein zusaetzliches `user_id`.
 */
export const getSessionProfile = cache(async (): Promise<SessionProfile | null> => {
  const user = await getSessionUser();
  if (!user) return null;

  const supabase = await createClient();
  const { data } = await supabase
    .from("profiles")
    .select("plan, is_admin, display_name, avatar_url, settings")
    .eq("id", user.id)
    .maybeSingle<SessionProfile>();

  return data ?? null;
});
