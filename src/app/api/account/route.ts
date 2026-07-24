import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

export const runtime = "nodejs";

// Permanently delete the signed-in user's account. The auth.users row cascades
// to profiles → projects → generations → subscriptions (all ON DELETE CASCADE),
// wiping every DB trace in a single step, but storage objects don't cascade
// with a DB row (same reason delete-project.tsx cleans up "project-files"
// itself, see 0012_project_files.sql's comment), so every project's attached
// files plus the avatar are removed here first, while the rows/session that
// let us read/authorize them still exist. Best-effort: a storage cleanup
// failure is logged but never blocks the account from actually being deleted,
// losing a few orphaned objects is far better than a user being stuck unable
// to delete their account because of a storage hiccup.
export async function DELETE() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // The id comes from the verified session, never from client input.
  if (!user) {
    return NextResponse.json({ error: "Nicht angemeldet." }, { status: 401 });
  }

  try {
    // project_files.user_id is direct (no join through projects needed), one
    // query covers every project this user has ever attached files to.
    const { data: files } = await supabase
      .from("project_files")
      .select("storage_path")
      .eq("user_id", user.id);
    if (files && files.length > 0) {
      await supabase.storage.from("project-files").remove(files.map((f) => f.storage_path));
    }
    // Always a fixed "{uid}/avatar" path (avatar-upload.tsx upserts in
    // place), removing a path that was never uploaded is a harmless no-op.
    await supabase.storage.from("avatars").remove([`${user.id}/avatar`]);
  } catch (err) {
    console.error("[account-delete] storage cleanup failed:", err);
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
