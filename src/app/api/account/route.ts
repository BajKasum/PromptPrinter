import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

export const runtime = "nodejs";

// Permanently delete the signed-in user's account. The auth.users row cascades
// to profiles → projects → generations → subscriptions (all ON DELETE CASCADE),
// so removing the auth user wipes every trace of them in a single step.
export async function DELETE() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // The id comes from the verified session — never from client input.
  if (!user) {
    return NextResponse.json({ error: "Nicht angemeldet." }, { status: 401 });
  }

  try {
    const admin = createAdminClient();
    const { error } = await admin.auth.admin.deleteUser(user.id);
    if (error) throw error;
  } catch (err) {
    const message =
      err instanceof Error && err.message.includes("admin credentials")
        ? "Server-Konfiguration unvollständig — Service-Role-Key fehlt."
        : "Konto konnte nicht gelöscht werden.";
    return NextResponse.json({ error: message }, { status: 500 });
  }

  // The user no longer exists, so just clear this browser's session cookies
  // locally — a global sign-out would round-trip to the auth server and fail.
  await supabase.auth.signOut({ scope: "local" });

  return NextResponse.json({ ok: true });
}
