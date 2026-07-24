import { NextResponse } from "next/server";
import { z } from "zod";
import { rateLimit, rateLimitKey } from "@/lib/rate-limit";
import { createClient } from "@/lib/supabase/server";
import { effectiveLimits, type PlanKey } from "@/lib/plans";

export const runtime = "nodejs";

// Direct workspace creation (REDESIGN.md, Phase 3): ein Projekt entsteht ab
// jetzt am Anfang der Arbeit, Name reicht, alles andere wächst im Workspace.
// Server-seitig, damit das Projekt-Limit des Plans hier durchgesetzt wird,
// nicht nur im Client.

const createProjectSchema = z.object({
  name: z.string().trim().min(2, "Name muss mindestens 2 Zeichen haben").max(80),
});

export async function POST(req: Request) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return problem(400, "Invalid JSON body");
  }

  const parsed = createProjectSchema.safeParse(body);
  if (!parsed.success) {
    return problem(400, "Invalid request", {
      issues: parsed.error.issues.map((i) => ({ path: i.path, message: i.message })),
    });
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return problem(401, "Anmeldung erforderlich.");

  // Plan allowance, the project cap now gates workspace creation. Filter by
  // owner explicitly even though RLS already scopes the count (defense in
  // depth; this count enforces a limit). Runs before the rate limit so its
  // is_admin result can exempt the account from that too, admin used to
  // only bypass the project cap, not the hourly rate limit.
  const [{ data: profile }, { count: projectCount }] = await Promise.all([
    supabase.from("profiles").select("plan, is_admin").eq("id", user.id).maybeSingle(),
    supabase
      .from("projects")
      .select("id", { count: "exact", head: true })
      .eq("user_id", user.id),
  ]);
  const rawPlan = (profile?.plan as string | undefined) ?? "free";
  const plan: PlanKey = rawPlan === "pro" || rawPlan === "team" ? rawPlan : "free";
  const isAdmin = profile?.is_admin ?? false;
  const limits = effectiveLimits(plan, isAdmin);
  if ((projectCount ?? 0) >= limits.projects) {
    return problem(
      403,
      `Projekt-Limit erreicht, dein Plan (${plan}) erlaubt ${limits.projects} Projekte. Upgrade für mehr.`,
      { kind: "projects", limit: limits.projects, current: projectCount ?? 0, plan }
    );
  }

  if (!isAdmin) {
    const rl = await rateLimit(rateLimitKey(req, user.id), {
      limit: 30,
      windowMs: 60 * 60 * 1000,
    });
    if (!rl.allowed) {
      return problem(429, "Zu viele Anfragen, bitte warte kurz und versuch es erneut.", {
        retryAfter: Math.ceil((rl.resetAt - Date.now()) / 1000),
      });
    }
  }

  // Ein leerer Workspace: nur Name + Owner. `type` ist ein internes Alt-Datum
  // (bestimmt den System-Prompt der Projekt-Chats), neutraler Default general.
  const { data: project, error } = await supabase
    .from("projects")
    .insert({ user_id: user.id, name: parsed.data.name, type: "general", status: "ready" })
    .select("id")
    .single();

  if (error || !project?.id) {
    return problem(500, `Projekt konnte nicht angelegt werden: ${error?.message ?? "unbekannt"}`);
  }

  return NextResponse.json({ projectId: project.id as string });
}

function problem(status: number, detail: string, extra: Record<string, unknown> = {}) {
  return NextResponse.json(
    {
      type: "about:blank",
      title:
        status === 400
          ? "Bad Request"
          : status === 401
            ? "Unauthorized"
            : status === 403
              ? "Forbidden"
              : status === 429
                ? "Too Many Requests"
                : "Error",
      status,
      detail,
      ...extra,
    },
    { status, headers: { "content-type": "application/problem+json" } }
  );
}
