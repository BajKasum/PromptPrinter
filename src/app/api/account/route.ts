import { NextResponse } from "next/server";
import { problem } from "@/server/http/api-problem";
import { createClient } from "@/server/supabase/server";
import { createAdminClient } from "@/server/supabase/admin";
import { rateLimit, rateLimitKey } from "@/server/security/rate-limit";
import { captureError } from "@/shared/lib/observability";
import { avatarStoragePath } from "@/features/settings/lib/avatar";
import { signedInRecently } from "@/features/auth/lib/fresh-sign-in";
import { collectStoragePaths, removeAllPaths } from "@/shared/lib/storage-cleanup";
import { cancelSubscriptionImmediately } from "@/server/billing/lemonsqueezy-api";
import { requestT } from "@/server/i18n";

export const runtime = "nodejs";

/**
 * Entfernt alle Storage-Objekte, auf die die Zeilen EINER Tabelle des Kontos zeigen.
 *
 * Seitenweise gelesen (collectStoragePaths), weil PostgREST eine Antwort bei 1000 Zeilen kappt und ein Konto
 * beliebig viele hat: Anhaenge bis zum Speicherkontingent (bei lauter kleinen Textdateien weit mehr als tausend),
 * Projektdateien mit Pro und als Admin ohne Projektgrenze (20 je Projekt, MAX_FILES_PER_PROJECT). Wuerde nach der
 * ersten Seite aufgehoert, blieben die uebrigen Objekte fuer immer im Bucket, ohne dass noch irgendeine Zeile auf
 * sie zeigt (#131). Entfernt wird in Stapeln, die einzeln scheitern duerfen: ein uebrig gebliebenes Objekt ist
 * harmlos (Migration 0029), alle liegen zu lassen, weil ein zu grosser Aufruf scheiterte, nicht.
 *
 * Wirft nie. Ein Lesefehler und Stapel, die nicht durchgingen, werden gemeldet; das Konto wird trotzdem geloescht.
 */
async function removeUserObjects(
  supabase: Awaited<ReturnType<typeof createClient>>,
  userId: string,
  target: {
    table: "message_attachments" | "project_files";
    bucket: string;
    /** Wie ein Objekt in der Fehlermeldung heisst, zum Beispiel "project file". */
    label: string;
    partialEvent: string;
    failedEvent: string;
  }
): Promise<void> {
  try {
    const paths = await collectStoragePaths((from, to) =>
      supabase
        .from(target.table)
        .select("storage_path")
        .eq("user_id", userId)
        // Stabile Reihenfolge, damit zwei Seiten sich weder ueberschneiden noch eine Zeile auslassen.
        .order("id")
        .range(from, to)
    );
    if (paths.length === 0) return;
    const { failed } = await removeAllPaths(
      (batch) => supabase.storage.from(target.bucket).remove(batch),
      paths
    );
    if (failed > 0) {
      captureError(target.partialEvent, new Error(`${failed} ${target.label}(s) could not be removed`), {
        userId,
      });
    }
  } catch (err) {
    captureError(target.failedEvent, err, { userId });
  }
}

// Permanently delete the signed-in user's account. The auth.users row cascades
// to profiles, and profiles cascades to EVERY user-scoped table: projects,
// conversations, messages, saved_prompts, project_files, subscriptions and
// user_api_keys (all ON DELETE CASCADE, verified against the live schema
// 2026-08-02 — this list used to name only four of them, which reads like the
// encrypted BYOK keys outlive a deletion when in fact they do not).
//
// That completeness is a promise the privacy policy makes out loud ( Ziffer 8
// of /datenschutz), so it is a DSGVO/revDSG commitment, not an implementation
// detail: anything user-scoped added later needs the same cascade, or that
// paragraph silently becomes false.
//
// A running Lemon Squeezy subscription does NOT cascade with any of that
// (K-5, Audit 06.09.2026): it lives entirely on Lemon Squeezy's side, keyed
// by profiles.subscription_id. Without cancelling it here first, a paying
// user who deletes their account keeps getting billed for an access that no
// longer exists — and once profiles is gone, no webhook can find them again
// to fix it (resolveUserId in the webhook route has nothing left to match).
// So the subscription is cancelled immediately (not "at period end") while
// the id to do that with still exists, before anything is torn down.
//
// Storage objects don't cascade
// with a DB row (same reason delete-project.tsx cleans up "project-files"
// itself, see 0012_project_files.sql's comment), so every project's attached
// files plus the avatar are removed here first, while the rows/session that
// let us read/authorize them still exist. Best-effort: a storage cleanup
// failure is logged but never blocks the account from actually being deleted,
// losing a few orphaned objects is far better than a user being stuck unable
// to delete their account because of a storage hiccup.
export async function DELETE(req: Request) {
  // Die Sprache der Fehlermeldungen: die der App (Cookie pp-locale).
  const m = requestT(req).t.api;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // The id comes from the verified session, never from client input.
  if (!user) {
    return problem(401, m.accountNotSignedIn);
  }

  // Die eine unumkehrbare Aktion der App verlangt eine frische Anmeldung (#132): ein ausgelesenes Cookie, ein
  // offener Rechner oder ein geteiltes Gerät reicht sonst, um alle Daten eines Nutzers zu vernichten (das
  // Sitzungs-Cookie ist bewusst nicht httpOnly). Wie die Seite "Neues Passwort" liest die Prüfung die
  // AMR-Liste des JWT; ohne belegbaren Zeitpunkt gilt die Sitzung als alt. Der Dialog schickt dann zur
  // erneuten Anmeldung (`code: "reauth_required"`).
  const { data: claims } = await supabase.auth.getClaims();
  if (!signedInRecently(claims?.claims.amr)) {
    return problem(403, m.accountReauthRequired, { code: "reauth_required" });
  }

  // Was the one route of the four that touch rateLimit (chat, projects,
  // settings/api-key) without any ceiling at all, a destructive one-shot
  // action doesn't need much headroom, this is only to blunt hammering the
  // endpoint with retries, not a real usage allowance. Admin exemption
  // mirrors the other three routes.
  const { data: profile } = await supabase
    .from("profiles")
    .select("is_admin, subscription_id")
    .eq("id", user.id)
    .maybeSingle();
  if (!(profile?.is_admin ?? false)) {
    const rl = await rateLimit(rateLimitKey(req, "account-delete", user.id), { limit: 5, windowMs: 60 * 60 * 1000 });
    if (!rl.allowed) {
      return problem(429, m.tooManyRequests, {
        retryAfter: Math.ceil((rl.resetAt - Date.now()) / 1000),
      });
    }
  }

  // K-5: best-effort, wie jeder Aufraeumschritt hier -- ein unerreichbares
  // oder ablehnendes Lemon Squeezy blockiert das Loeschen des Kontos nicht,
  // ein Nutzer, der deshalb nicht loeschen kann, waere schlimmer als ein Abo,
  // das von Hand nachgezogen werden muss.
  if (profile?.subscription_id) {
    const result = await cancelSubscriptionImmediately(profile.subscription_id);
    if (!result.ok) {
      captureError("account.subscription_cancel_failed", new Error(result.reason), {
        userId: user.id,
        subscriptionId: profile.subscription_id,
      });
    }
  }

  // Fotos und Dateien aus Chats (Migration 0045) und die Dateien der Projekte.
  // Je Tabelle ein eigener Schritt mit eigenem try (removeUserObjects): ein
  // Fehler bei der einen (zum Beispiel eine noch nicht angewendete Migration)
  // darf weder die andere noch das Loeschen des Kontos aufhalten.
  await removeUserObjects(supabase, user.id, {
    table: "message_attachments",
    bucket: "chat-attachments",
    label: "chat attachment",
    partialEvent: "account.attachment_cleanup_partial",
    failedEvent: "account.attachment_cleanup_failed",
  });
  // project_files.user_id is direct (no join through projects needed), one
  // query covers every project this user has ever attached files to.
  await removeUserObjects(supabase, user.id, {
    table: "project_files",
    bucket: "project-files",
    label: "project file",
    partialEvent: "account.storage_cleanup_partial",
    failedEvent: "account.storage_cleanup_failed",
  });

  try {
    // Always a fixed "{uid}/avatar" path (migration 0027 pins the insert
    // policy to exactly that name — the upload UI that used to write it here
    // is gone, but old objects from before its removal may still exist),
    // removing a path that was never uploaded is a harmless no-op.
    await supabase.storage.from("avatars").remove([avatarStoragePath(user.id)]);
  } catch (err) {
    captureError("account.storage_cleanup_failed", err, { userId: user.id });
  }

  try {
    const admin = createAdminClient();
    const { error } = await admin.auth.admin.deleteUser(user.id);
    if (error) throw error;
  } catch (err) {
    const message =
      err instanceof Error && err.message.includes("admin credentials")
        ? m.accountConfigIncomplete
        : m.accountDeleteFailed;
    return problem(500, message);
  }

  // The user no longer exists, so just clear this browser's session cookies
  // locally, a global sign-out would round-trip to the auth server and fail.
  await supabase.auth.signOut({ scope: "local" });

  return NextResponse.json({ ok: true });
}
