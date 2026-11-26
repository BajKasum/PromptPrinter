import "server-only";

import { BrainAnalysisError } from "@/server/brain/analyze";
import { GithubImportError } from "@/server/brain/github";
import { problem } from "@/server/http/api-problem";
import type { createAdminClient } from "@/server/supabase/admin";
import type { Messages } from "@/shared/i18n/messages/de";
import { captureError } from "@/shared/lib/observability";

// Der Fehlerweg der Gedächtnis-Analyse (app/api/projects/[id]/brain/route.ts): Fehlerprotokoll, der Status "failed" in
// der Zeile und die Antwort. In die Antwort und in die Datenbank geht nur ein stabiler Code, nie der Wortlaut des
// Fehlers: der eines Anbieters oder von Postgres nennt Anbieter, Modell oder Tabellen.

/** Meldet eine gescheiterte Analyse, setzt ihren Status auf "failed" und antwortet mit 502 in der App-Sprache. */
export async function reportAnalysisFailure(
  err: unknown,
  ctx: {
    admin: ReturnType<typeof createAdminClient>;
    projectId: string;
    userId: string;
    byok: boolean;
    startedAt: number;
    m: Messages["api"];
  }
): Promise<Response> {
  const { admin, projectId, userId, byok, startedAt, m } = ctx;
  const code = errorCode(err);
  captureError("brain.analysis_failed", err, {
    userId,
    projectId,
    code,
    byok,
    latencyMs: Date.now() - startedAt,
  });

  const { error: failedWriteError } = await admin
    .from("project_brains")
    .update({ status: "failed", error_code: code, updated_at: new Date().toISOString() })
    .eq("project_id", projectId)
    .eq("user_id", userId);
  // Best effort: die Antwort unten meldet den Fehler so oder so; nur der Status bleibt dann auf "analyzing" stehen,
  // den die Leseseite nach einer Frist selbst auflöst (isAnalysisRunning).
  if (failedWriteError) captureError("brain.failed_status_write_failed", failedWriteError, { userId, projectId });

  return problem(502, describeBrainFailure(code, m), { code });
}

/** Stabiler Code aus dem geworfenen Fehler, nie dessen Wortlaut. */
function errorCode(err: unknown): string {
  if (err instanceof GithubImportError) return err.code;
  if (err instanceof BrainAnalysisError) return err.code;
  return "analysis_failed";
}

/** Der Text zum Code in der App-Sprache; ein Code ohne eigenen Text bekommt den allgemeinen. */
function describeBrainFailure(code: string, m: Messages["api"]): string {
  const known: Record<string, string> = m.brainErrors;
  return known[code] ?? m.brainErrors.other;
}
