import { NextResponse } from "next/server";
import { createClient } from "@/server/supabase/server";
import { problem } from "@/server/http/api-problem";
import { denied } from "@/server/security/security-log";
import { captureError } from "@/shared/lib/observability";
import { isRepoStale } from "@/server/brain/repo-status";
import { rateLimit, rateLimitKey } from "@/server/security/rate-limit";
import { requestT } from "@/server/i18n";

export const runtime = "nodejs";

// Hat sich das analysierte GitHub-Repo seit der Analyse geändert? (#244)
//
// Eine Leseroute: sie ändert nichts, nutzt kein Modell und zählt gegen kein Kontingent. Sie liest die eigene
// Zeile in project_brains (RLS und explizites user_id) und vergleicht die gespeicherte Baum-SHA mit dem Stand
// bei GitHub, siehe server/brain/repo-status.ts. `stale: null` heisst "unbekannt" und führt in der Oberfläche
// zu keinem Hinweis: kein Repo, kein Vergleich möglich, GitHub nicht erreichbar.
//
// Das Workspace-Layout ruft diese Route nie auf: die Karte des Gedächtnisses fragt selbst, wenn sie erscheint.

type Params = { params: Promise<{ id: string }> };

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function GET(req: Request, { params }: Params) {
  const m = requestT(req).t.api;
  const { id: projectId } = await params;
  if (!UUID.test(projectId)) return denied("brain-status", problem(404, m.projectNotFound));

  let supabase: Awaited<ReturnType<typeof createClient>>;
  try {
    supabase = await createClient();
  } catch {
    return problem(503, m.brainUnavailable);
  }

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return denied("brain-status", problem(401, m.signInRequired));

  // Die Karte fragt höchstens einmal je Öffnen; mehr ist kein Mensch. Über der Grenze "unbekannt", also kein Hinweis
  // und keine Anfrage an GitHub: fehlt der Hinweis, geht nichts kaputt.
  const rl = await rateLimit(rateLimitKey(req, "brain-status", user.id), { limit: 120, windowMs: 60 * 60 * 1000 });
  if (!rl.allowed) return NextResponse.json({ stale: null }, { headers: { "cache-control": "no-store" } });

  // Fremd und nicht vorhanden sehen gleich aus: beides `null`, die Route verrät keine Projekt-IDs.
  const { data: row, error } = await supabase
    .from("project_brains")
    .select("status, repo_url, repo_ref")
    .eq("project_id", projectId)
    .eq("user_id", user.id)
    .maybeSingle();
  if (error) {
    captureError("brain.status_read_failed", error, { userId: user.id, projectId });
    return problem(503, m.brainUnavailable);
  }

  const stale =
    row && row.status === "ready" ? await isRepoStale(row.repo_url, row.repo_ref, req.signal) : null;

  // Nie aus dem Browser-Zwischenspeicher: nach "Neu analysieren" muss die nächste Antwort stimmen.
  return NextResponse.json({ stale }, { headers: { "cache-control": "no-store" } });
}
