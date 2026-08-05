import "server-only";

import { cache } from "react";
import { notFound, redirect } from "next/navigation";
import { createClient } from "@/server/supabase/server";
import { getSessionUser } from "@/server/session";

// The workspace shell (layout) and its subroutes (Übersicht, Chats, Ergebnisse)
// all need the same project row. Layouts can't pass props to pages, so every
// segment calls getProject(id), React's cache() dedupes it to one query per
// request. Missing/foreign ids 404 here, so callers get a non-null project.

export type WorkspaceProject = {
  id: string;
  /** The signed-in owner. Exposed so callers (the workspace layout's own
   *  chat/result/file counts) can add the same explicit `.eq("user_id", …)`
   *  defense-in-depth this project applies everywhere else, without a second
   *  auth round trip — getProject() already paid for this call
   *  (Security-Audit finding L-3). */
  userId: string;
  name: string;
  instructions: string | null;
  context: Record<string, string>;
  audience: string | null;
  idea: string | null;
  tools: Record<string, string> | null;
  type: string;
  status: string;
  is_favorite: boolean;
  updated_at: string;
};

type ProjectRow = Omit<WorkspaceProject, "context" | "tools"> & {
  context: unknown;
  tools: unknown;
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
  // getSessionUser() statt eines eigenen auth.getUser() (Planpunkt B-3):
  // diese Funktion ist zwar schon `cache()`-dedupliziert, aber nur gegen sich
  // selbst — ihr Auth-Aufruf lief zusaetzlich zu dem im (app)-Layout und dem
  // auf der Seite. Jetzt teilen sich alle drei denselben.
  const user = await getSessionUser();
  if (!user) redirect("/login");

  const supabase = await createClient();

  // RLS scopes the read to the owner; the explicit .eq("user_id", …) is
  // defense-in-depth on top of it (CLAUDE.md's own standard for user-scoped
  // queries, Security-Audit finding L-3 — this read was RLS-only before).
  // Either a foreign owner or a malformed/missing id yields no row, so both
  // cases 404 identically below rather than distinguishing "not yours" from
  // "doesn't exist", which would leak which ids are in use.
  const { data } = await supabase
    .from("projects")
    .select(
      "id, name, instructions, context, audience, idea, tools, type, status, is_favorite, updated_at"
    )
    .eq("id", id)
    .eq("user_id", user.id)
    .maybeSingle<ProjectRow>();

  if (!data) notFound();

  return {
    ...data,
    userId: user.id,
    context: asStringRecord(data.context),
    tools: data.tools ? asStringRecord(data.tools) : null,
  };
});
