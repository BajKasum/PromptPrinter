import "server-only";

import { cache } from "react";
import { notFound, redirect } from "next/navigation";
import { createClient } from "@/server/supabase/server";
import { isUuid } from "@/shared/lib/uuid";
import { getSessionUser } from "@/server/session";
import { orThrow } from "@/server/supabase/query";

// The workspace shell (layout) and its subroutes (Übersicht, Chats, Ergebnisse)
// all need the same project row. Layouts can't pass props to pages, so every
// segment calls getProject(id), React's cache() dedupes it to one query per
// request. Missing/foreign ids 404 here, so callers get a non-null project.

export type WorkspaceProject = {
  id: string;
  /** The signed-in owner. Exposed so callers (the workspace layout's own
   *  chat/result/file counts) can add the same explicit `.eq("user_id", …)`
   *  defense-in-depth this project applies everywhere else, without a second
   *  auth round trip — getProject() already paid for this call. */
  userId: string;
  name: string;
  instructions: string | null;
  context: Record<string, string>;
  audience: string | null;
  idea: string | null;
  type: string;
  is_favorite: boolean;
  updated_at: string;
};

function asStringRecord(value: unknown): Record<string, string> {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  const out: Record<string, string> = {};
  for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
    if (typeof v === "string" && v.trim().length > 0) out[k] = v;
  }
  return out;
}

export const getProject = cache(async (id: string): Promise<WorkspaceProject> => {
  // getSessionUser() statt eines eigenen auth.getUser(): diese Funktion ist
  // zwar schon `cache()`-dedupliziert, aber nur gegen sich selbst. So teilen
  // sich (app)-Layout, Seite und getProject() denselben Auth-Aufruf.
  const user = await getSessionUser();
  if (!user) redirect("/login");

  // Eine vertippte Kennung ist ein 404, keine Fehlerseite: Postgres lehnte sie mit einem Fehler ab, und der wirft.
  if (!isUuid(id)) notFound();

  const supabase = await createClient();

  // RLS scopes the read to the owner; the explicit .eq("user_id", …) is
  // defense-in-depth on top of it (CLAUDE.md's own standard for user-scoped
  // queries).
  // Either a foreign owner or a malformed/missing id yields no row, so both
  // cases 404 identically below rather than distinguishing "not yours" from
  // "doesn't exist", which would leak which ids are in use.
  // Ein Lesefehler ist kein "nicht gefunden": er wirft (Fehlerseite), statt ein vorhandenes Projekt als 404 zu zeigen.
  const { data } = orThrow(
    await supabase
      .from("projects")
      .select("id, name, instructions, context, audience, idea, type, is_favorite, updated_at")
      .eq("id", id)
      .eq("user_id", user.id)
      .maybeSingle(),
    "projects"
  );

  if (!data) notFound();

  return {
    ...data,
    userId: user.id,
    context: asStringRecord(data.context),
  };
});
