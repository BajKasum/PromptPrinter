import { cache } from "react";
import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

// The workspace shell (layout) and its subroutes (Übersicht, Chats, Ergebnisse)
// all need the same project row. Layouts can't pass props to pages, so every
// segment calls getProject(id) — React's cache() dedupes it to one query per
// request. Missing/foreign ids 404 here, so callers get a non-null project.

export type WorkspaceProject = {
  id: string;
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
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  // RLS scopes the read to the owner — a malformed or foreign id yields no row.
  const { data } = await supabase
    .from("projects")
    .select(
      "id, name, instructions, context, audience, idea, tools, type, status, is_favorite, updated_at"
    )
    .eq("id", id)
    .maybeSingle<ProjectRow>();

  if (!data) notFound();

  return {
    ...data,
    context: asStringRecord(data.context),
    tools: data.tools ? asStringRecord(data.tools) : null,
  };
});
