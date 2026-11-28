import { NextResponse } from "next/server";
import { problem, rateLimitedProblem } from "@/server/http/api-problem";
import { createClient } from "@/server/supabase/server";
import { createAdminClient } from "@/server/supabase/admin";
import { lacksSecondFactor } from "@/server/supabase/assurance";
import { rateLimit, rateLimitKey } from "@/server/security/rate-limit";
import { captureError } from "@/shared/lib/observability";
import { recordSecurityEvent } from "@/server/security/security-events";
import { denied } from "@/server/security/security-log";
import { avatarStoragePath } from "@/features/settings/lib/avatar";
import { signedInRecently } from "@/features/auth/lib/fresh-sign-in";
import { collectStoragePaths, removeAllPaths } from "@/shared/lib/storage-cleanup";
import { requestT } from "@/server/i18n";
import type { Messages } from "@/shared/i18n/messages/de";

export const runtime = "nodejs";

type UserClient = Awaited<ReturnType<typeof createClient>>;
type AdminClient = ReturnType<typeof createAdminClient>;

/** Eine Tabelle, deren Zeilen auf Storage-Objekte des Kontos zeigen, und wie ihre Fehler im Log heißen. */
type ObjectSource = {
  table: "message_attachments" | "project_files";
  bucket: string;
  /** Wie ein Objekt in der Fehlermeldung heißt, zum Beispiel "project file". */
  label: string;
  partialEvent: string;
  failedEvent: string;
};

// Fotos und Dateien aus Chats (Migration 0045) und die Dateien der Projekte. Je Tabelle ein eigener Schritt: ein
// Fehler bei der einen (zum Beispiel eine noch nicht angewendete Migration) hält weder die andere noch das Löschen
// des Kontos auf.
const OBJECT_SOURCES: readonly ObjectSource[] = [
  {
    table: "message_attachments",
    bucket: "chat-attachments",
    label: "chat attachment",
    partialEvent: "account.attachment_cleanup_partial",
    failedEvent: "account.attachment_cleanup_failed",
  },
  {
    // project_files.user_id steht direkt in der Zeile: eine Abfrage deckt jedes Projekt des Kontos ab.
    table: "project_files",
    bucket: "project-files",
    label: "project file",
    partialEvent: "account.storage_cleanup_partial",
    failedEvent: "account.storage_cleanup_failed",
  },
];

type CollectedObjects = { source: ObjectSource; paths: string[] }[];

/**
 * Liest die Pfade aller Storage-Objekte des Kontos, mit der Sitzung des Nutzers, solange die Zeilen noch da sind.
 *
 * Seitenweise (collectStoragePaths), weil PostgREST eine Antwort bei 1000 Zeilen kappt und ein Konto beliebig viele
 * hat: Anhänge bis zum Speicherkontingent (bei lauter kleinen Textdateien weit mehr als tausend), Projektdateien als
 * Admin ohne Projektgrenze. Nach `id` sortiert, damit zwei Seiten sich weder überschneiden noch eine Zeile auslassen.
 *
 * Wirft nie. Scheitert das Lesen einer Tabelle, wird es gemeldet, und ihre Objekte bleiben nach dem Löschen liegen:
 * scripts/reconcile-project-files-storage.mjs findet sie (docs/SETUP.md).
 */
async function collectAccountObjects(supabase: UserClient, userId: string): Promise<CollectedObjects> {
  const collected: CollectedObjects = [];
  for (const source of OBJECT_SOURCES) {
    try {
      const paths = await collectStoragePaths((from, to) =>
        supabase.from(source.table).select("storage_path").eq("user_id", userId).order("id").range(from, to)
      );
      collected.push({ source, paths });
    } catch (err) {
      captureError(source.failedEvent, err, { userId });
    }
  }
  return collected;
}

/** Ob ein Pfad im Ordner des Kontos liegt: sein erster Abschnitt ist genau die Kennung ({userId}/{ordner}/{datei}). */
function inAccountFolder(path: string, userId: string): boolean {
  return path.split("/")[0] === userId;
}

/**
 * Entfernt die eingesammelten Objekte und den Avatar, erst wenn das Konto gelöscht ist. Mit dem Admin-Client: die
 * Sitzung gehört dann zu einem Konto, das es nicht mehr gibt.
 *
 * Nur Pfade im Ordner des Kontos. Der Admin-Client umgeht die RLS des Buckets, die sonst nur den eigenen Ordner
 * freigibt, und `project_files` schreibt der Browser selbst; dass eine Zeile nur auf ein eigenes Objekt zeigt, prüft
 * beim Einfügen ein Trigger (Migration 0042), auf den sich das Löschen nicht verlässt. Was außerhalb liegt, bleibt
 * liegen und wird nur gezählt gemeldet, nie mit Pfad.
 *
 * In Stapeln, die einzeln scheitern dürfen (removeAllPaths): ein übrig gebliebenes Objekt ist harmlos (Migration
 * 0029), alle liegen zu lassen, weil ein zu großer Aufruf scheiterte, nicht. Wirft nie: Stapel, die nicht durchgingen,
 * werden gemeldet, das Konto bleibt gelöscht.
 */
async function removeAccountObjects(admin: AdminClient, userId: string, collected: CollectedObjects): Promise<void> {
  for (const { source, paths: collectedPaths } of collected) {
    const paths = collectedPaths.filter((path) => inAccountFolder(path, userId));
    const foreign = collectedPaths.length - paths.length;
    if (foreign > 0) {
      captureError(
        "account.cleanup_foreign_path_skipped",
        new Error(`${foreign} ${source.label}(s) outside the account folder skipped`),
        { userId }
      );
    }
    if (paths.length === 0) continue;
    const { failed } = await removeAllPaths((batch) => admin.storage.from(source.bucket).remove(batch), paths);
    if (failed > 0) {
      captureError(source.partialEvent, new Error(`${failed} ${source.label}(s) could not be removed`), { userId });
    }
  }

  try {
    // Immer der feste Pfad "{uid}/avatar" (Migration 0027). Hochladen lässt sich dort nichts mehr, alte Objekte kann es
    // geben; einen nie hochgeladenen Pfad zu entfernen ist folgenlos.
    await admin.storage.from("avatars").remove([avatarStoragePath(userId)]);
  } catch (err) {
    captureError("account.storage_cleanup_failed", err, { userId });
  }
}

// Löscht das Konto der angemeldeten Person endgültig. Die Zeile in auth.users kaskadiert auf profiles, profiles auf
// jede Tabelle mit Nutzerdaten: projects, conversations, messages, saved_prompts, project_files, subscriptions und
// user_api_keys (alle ON DELETE CASCADE). Diese Vollständigkeit sagt die Datenschutzerklärung zu (Ziffer 8 von
// /datenschutz), sie ist eine Zusage nach DSGVO und revDSG: jede neue Tabelle mit Nutzerdaten braucht dieselbe
// Kaskade, sonst wird der Absatz still falsch. Die eine Ausnahme ist public.security_events: "Konto gelöscht" muss das
// Konto überleben, nur die Kennung, höchstens 180 Tage.
//
// Storage-Objekte kaskadieren nicht mit einer Zeile (wie beim Löschen eines Projekts, delete-project.tsx), die Route
// räumt sie selbst ab, in dieser Reihenfolge:
//   1. die Pfade einsammeln, solange die Zeilen noch lesbar sind;
//   2. das Konto löschen; scheitert das, bleibt alles, wie es war, Zeilen und Dateien;
//   3. erst danach die Objekte entfernen, ein Schritt ohne Rückweg.
// Das Aufräumen hält das Löschen nie auf: lieber ein paar verwaiste Objekte (unsichtbar, das Skript findet sie) als ein
// Konto, das sich wegen einer Störung im Speicher nicht löschen lässt.
export async function DELETE(req: Request) {
  // Die Sprache der Fehlermeldungen: die der App (Cookie pp-locale).
  const m = requestT(req).t.api;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // The id comes from the verified session, never from client input.
  if (!user) {
    return denied("account", problem(401, m.accountNotSignedIn));
  }

  // Wer einen zweiten Faktor eingerichtet hat, löscht das Konto nur mit Nachweis (docs/SETUP.md, "Zweiter Faktor").
  if (await lacksSecondFactor(supabase, user)) {
    return denied("account", problem(403, m.secondFactorRequired, { code: "aal2_required" }), { userId: user.id });
  }

  // Die eine unumkehrbare Aktion der App verlangt eine frische Anmeldung (#132): ein ausgelesenes Cookie, ein
  // offener Rechner oder ein geteiltes Gerät reicht sonst, um alle Daten eines Nutzers zu vernichten (das
  // Sitzungs-Cookie ist bewusst nicht httpOnly). Wie die Seite "Neues Passwort" liest die Prüfung die
  // AMR-Liste des JWT; ohne belegbaren Zeitpunkt gilt die Sitzung als alt. Der Dialog schickt dann zur
  // erneuten Anmeldung (`code: "reauth_required"`).
  const { data: claims } = await supabase.auth.getClaims();
  if (!signedInRecently(claims?.claims.amr)) {
    return denied("account", problem(403, m.accountReauthRequired, { code: "reauth_required" }), { userId: user.id });
  }

  // Was the one route of the four that touch rateLimit (chat, projects,
  // settings/api-key) without any ceiling at all, a destructive one-shot
  // action doesn't need much headroom, this is only to blunt hammering the
  // endpoint with retries, not a real usage allowance. Admin exemption
  // mirrors the other three routes.
  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("is_admin")
    .eq("id", user.id)
    .maybeSingle();
  // Ein Lesefehler ist kein "kein Admin": die Route rät nicht, sie antwortet 503, und ein neuer Versuch kostet nichts.
  if (profileError) {
    captureError("account.delete_profile_read_failed", profileError, { userId: user.id });
    return problem(503, m.accountDeleteFailed);
  }
  const limited = await enforceDeleteLimit(req, user.id, profile?.is_admin ?? false, m);
  if (limited) return limited;

  const objects = await collectAccountObjects(supabase, user.id);

  let admin: AdminClient;
  try {
    admin = createAdminClient();
    const { error } = await admin.auth.admin.deleteUser(user.id);
    if (error) throw error;
  } catch (err) {
    captureError("account.delete_failed", err, { userId: user.id });
    const message =
      err instanceof Error && err.message.includes("admin credentials")
        ? m.accountConfigIncomplete
        : m.accountDeleteFailed;
    return problem(500, message);
  }

  await recordSecurityEvent("account.deleted", user.id);

  await removeAccountObjects(admin, user.id, objects);

  // The user no longer exists, so just clear this browser's session cookies
  // locally, a global sign-out would round-trip to the auth server and fail.
  await supabase.auth.signOut({ scope: "local" });

  return NextResponse.json({ ok: true });
}

/** Stundenlimit fürs Löschen, Admins ausgenommen: die Absage als Antwort, sonst null. */
async function enforceDeleteLimit(req: Request, userId: string, isAdmin: boolean, m: Messages["api"]): Promise<Response | null> {
  if (isAdmin) return null;
  const rl = await rateLimit(rateLimitKey(req, "account-delete", userId), { limit: 5, windowMs: 60 * 60 * 1000 });
  return rl.allowed ? null : rateLimitedProblem(m.tooManyRequests, rl);
}
