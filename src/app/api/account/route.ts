import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { rateLimit, rateLimitKey } from "@/lib/rate-limit";
import { captureError } from "@/lib/observability";
import { avatarStoragePath } from "@/lib/avatar";
import { removeAllPaths } from "@/lib/storage-cleanup";

export const runtime = "nodejs";

// Permanently delete the signed-in user's account. The auth.users row cascades
// to profiles, and profiles cascades to EVERY user-scoped table: projects,
// conversations, messages, generations, project_files, subscriptions and
// user_api_keys (all ON DELETE CASCADE, verified against the live schema
// 2026-08-02 — this list used to name only four of them, which reads like the
// encrypted BYOK keys outlive a deletion when in fact they do not).
//
// That completeness is a promise the privacy policy makes out loud ( Ziffer 8
// of /datenschutz), so it is a DSGVO/revDSG commitment, not an implementation
// detail: anything user-scoped added later needs the same cascade, or that
// paragraph silently becomes false.
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
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // The id comes from the verified session, never from client input.
  if (!user) {
    return NextResponse.json({ error: "Nicht angemeldet." }, { status: 401 });
  }

  // Was the one route of the four that touch rateLimit (chat, projects,
  // settings/api-key) without any ceiling at all, a destructive one-shot
  // action doesn't need much headroom, this is only to blunt hammering the
  // endpoint with retries, not a real usage allowance. Admin exemption
  // mirrors the other three routes.
  const { data: profile } = await supabase
    .from("profiles")
    .select("is_admin")
    .eq("id", user.id)
    .maybeSingle();
  if (!(profile?.is_admin ?? false)) {
    const rl = await rateLimit(rateLimitKey(req, user.id), { limit: 5, windowMs: 60 * 60 * 1000 });
    if (!rl.allowed) {
      return NextResponse.json(
        { error: "Zu viele Anfragen, bitte warte kurz und versuch es erneut." },
        { status: 429 }
      );
    }
  }

  try {
    // project_files.user_id is direct (no join through projects needed), one
    // query covers every project this user has ever attached files to.
    const { data: files } = await supabase
      .from("project_files")
      .select("storage_path")
      .eq("user_id", user.id);
    if (files && files.length > 0) {
      // Batched: this is the one cleanup path with no upper bound on file
      // count (Pro has no project cap, and each project holds up to 10 files),
      // so a single remove() call here can carry thousands of paths in one
      // request body. Batches fail independently, since leaving some objects
      // behind is harmless (migration 0029) but stranding all of them because
      // one oversized request failed is not.
      const { failed } = await removeAllPaths(
        (paths) => supabase.storage.from("project-files").remove(paths),
        files.map((f) => f.storage_path)
      );
      if (failed > 0) {
        captureError(
          "account.storage_cleanup_partial",
          new Error(`${failed} project file(s) could not be removed`),
          { userId: user.id }
        );
      }
    }
    // Always a fixed "{uid}/avatar" path (avatar-upload.tsx upserts in place,
    // and migration 0027 pins the insert policy to exactly that name), removing
    // a path that was never uploaded is a harmless no-op.
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
        ? "Server-Konfiguration unvollständig, Service-Role-Key fehlt."
        : "Konto konnte nicht gelöscht werden.";
    return NextResponse.json({ error: message }, { status: 500 });
  }

  // The user no longer exists, so just clear this browser's session cookies
  // locally, a global sign-out would round-trip to the auth server and fail.
  await supabase.auth.signOut({ scope: "local" });

  return NextResponse.json({ ok: true });
}
