import "server-only";

import { cache } from "react";
import type { User } from "@supabase/supabase-js";
import { createClient } from "@/server/supabase/server";
import { requiresOwnKey, toPlanKey } from "@/shared/lib/plans";

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
 * braucht (`plan`/`is_admin` fuer Limits, `display_name` fuer die Anzeige,
 * `settings` u.a. fuer den "interested_in"-Marker aus dem Pro-Signup). Es ist
 * genau eine Zeile;
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
    .select("plan, is_admin, display_name, settings")
    .eq("id", user.id)
    .maybeSingle<SessionProfile>();

  return data ?? null;
});

/**
 * Braucht der angemeldete Nutzer einen eigenen Key, bevor er chatten kann?
 *
 * Free hat seit 30.07.2026 kein Kontingent auf dem Server-Key (plans.ts), ein
 * Free-Konto ohne hinterlegten Key bekommt von /api/chat also immer 403
 * `byokRequired`. Die Chat-Seiten fragen das hier vorab, damit der Hinweis
 * schon im leeren Chat steht (Audit 23.09.2026, F-1).
 *
 * Liest nur `provider`, das in der SELECT-Allowlist von `authenticated` liegt
 * (0020/0030) — der Schluessel selbst bleibt unangetastet. Jede Zeile zaehlt,
 * genau wie in getUserOverride (byok.ts), das ebenfalls jede Zeile nimmt.
 */
export const getNeedsOwnKey = cache(async (): Promise<boolean> => {
  const user = await getSessionUser();
  if (!user) return false;

  const profile = await getSessionProfile();
  const plan = toPlanKey(profile?.plan);
  const isAdmin = profile?.is_admin ?? false;
  // Pro, Team und Admins laufen ohnehin auf dem Server-Key, keine Abfrage noetig.
  if (!requiresOwnKey(plan, isAdmin, false)) return false;

  const supabase = await createClient();
  const { data } = await supabase
    .from("user_api_keys")
    .select("provider")
    .eq("user_id", user.id)
    .limit(1);

  return requiresOwnKey(plan, isAdmin, (data?.length ?? 0) > 0);
});
