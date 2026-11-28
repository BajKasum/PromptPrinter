import { NextResponse } from "next/server";
import { z } from "@/shared/lib/zod";
import { rateLimit, rateLimitKey } from "@/server/security/rate-limit";
import { createClient } from "@/server/supabase/server";
import { resolvePlan } from "@/shared/lib/plans";
import { problem, rateLimitedProblem } from "@/server/http/api-problem";
import { readValidatedBody } from "@/server/http/validated-body";
import { captureError } from "@/shared/lib/observability";
import { denied } from "@/server/security/security-log";
import { requestT } from "@/server/i18n";
import { fmt } from "@/shared/i18n/format";
import type { Messages } from "@/shared/i18n/messages/de";

export const runtime = "nodejs";

// Direct workspace creation (REDESIGN.md, Phase 3): ein Projekt entsteht ab
// jetzt am Anfang der Arbeit, Name reicht, alles andere wächst im Workspace.
// Server-seitig, damit die Projekt-Grenze (plans.ts, dazu der Trigger
// enforce_project_cap der Datenbank) hier durchgesetzt wird, nicht nur im Client.

const createProjectSchema = z.object({
  name: z.string().trim().min(2, "Name muss mindestens 2 Zeichen haben").max(80),
});

export async function POST(req: Request) {
  // Die Sprache der Fehlermeldungen: die der App (Cookie pp-locale).
  const m = requestT(req).t.api;
  // Session first, body second (Security-Audit finding H-3): parsing before
  // authenticating let an unauthenticated caller make the server read and parse
  // an unbounded payload just to be told 401. readValidatedBody caps the read too.
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return denied("projects", problem(401, m.signInRequired));

  const input = await readValidatedBody(req, createProjectSchema, m);
  if (input instanceof Response) return input;

  const refused = await enforceProjectLimits(req, supabase, user.id, m);
  if (refused) return refused;

  // Ein leerer Workspace: nur Name + Owner. `type` startet als general; das
  // Häkchen "Softwareprojekt" im Workspace stellt es auf software um.
  const { data: project, error } = await supabase
    .from("projects")
    .insert({ user_id: user.id, name: input.data.name, type: "general" })
    .select("id")
    .single();

  if (error || !project?.id) {
    // Generic to the client, detailed to the logs (Security-Audit finding
    // M-1): a PostgREST/Postgres message names constraints, columns and
    // policies, which is schema disclosure for anyone who can POST here.
    captureError("projects.create_failed", error ?? new Error("insert returned no id"), {
      userId: user.id,
    });
    return problem(500, m.projectCreateFailed);
  }

  return NextResponse.json({ projectId: project.id as string });
}

/** Projekt-Grenze und Stundenlimit: die Absage als Antwort, sonst null. */
async function enforceProjectLimits(
  req: Request,
  supabase: Awaited<ReturnType<typeof createClient>>,
  userId: string,
  m: Messages["api"]
): Promise<Response | null> {
  // Die Projekt-Grenze gilt für jedes Konto ausser Admins. Die Zählung filtert
  // ausdrücklich auf den Eigentümer, obwohl RLS sie schon eingrenzt (zweite
  // Linie, die Zählung setzt eine Grenze durch). Sie läuft vor dem Stundenlimit,
  // damit is_admin das Konto auch davon ausnehmen kann.
  const [profileResult, countResult] = await Promise.all([
    supabase.from("profiles").select("plan, is_admin").eq("id", userId).maybeSingle(),
    supabase
      .from("projects")
      .select("id", { count: "exact", head: true })
      .eq("user_id", userId),
  ]);
  // Ein Lesefehler ist keine Antwort: Zählung 0 hieße "unter der Grenze", Profil null nähme einem Admin die Ausnahme.
  if (profileResult.error || countResult.error) {
    captureError("projects.limit_read_failed", profileResult.error ?? countResult.error, { userId });
    return problem(503, m.projectCreateFailed);
  }
  const { plan, isAdmin, limits } = resolvePlan(profileResult.data);
  const projectCount = countResult.count;
  if ((projectCount ?? 0) >= limits.projects) {
    return denied(
      "projects",
      problem(
        403,
        fmt(m.projectLimit, { plan, limit: limits.projects }),
        { kind: "projects", limit: limits.projects, current: projectCount ?? 0, plan }
      ),
      { userId, reason: "project_limit" }
    );
  }

  if (!isAdmin) {
    const rl = await rateLimit(rateLimitKey(req, "projects", userId), {
      limit: 30,
      windowMs: 60 * 60 * 1000,
    });
    if (!rl.allowed) return rateLimitedProblem(m.tooManyRequests, rl);
  }
  return null;
}
