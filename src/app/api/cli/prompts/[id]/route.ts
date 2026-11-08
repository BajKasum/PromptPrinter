import { NextResponse } from "next/server";
import { problem } from "@/server/http/api-problem";
import { bearerToken } from "@/server/supabase/bearer";
import { createClientForRequest } from "@/server/supabase/server";
import { orThrow } from "@/server/supabase/query";
import { rateLimit, rateLimitKey } from "@/server/security/rate-limit";
import { requestT } from "@/server/i18n";
import { CLI_PROBLEMS } from "@/server/cli-login/messages";
import { checkCliSession } from "@/server/cli-login/sessions";
import { SAVED_PROMPT_COLUMNS, isPromptId, toDetail } from "@/server/cli-login/saved-prompts";
import { captureError } from "@/shared/lib/observability";

export const runtime = "nodejs";

// Ein gespeicherter Prompt ganz, für das Terminal (get_saved_prompt im MCP-Server). Nur lesen, nur per Bearer,
// über die RLS-Sitzung und dazu ausdrücklich nach `user_id`. Eine fremde Zeile und eine, die es nicht gibt,
// bekommen dieselbe Antwort 404 `notFound`: die Route verrät nicht, ob eine ID woanders existiert. Keine UUID
// ist 400 `invalid`, ohne die Datenbank zu fragen.
const RATE_LIMIT = { limit: 120, windowMs: 10 * 60 * 1000 };

type Params = { params: Promise<{ id: string }> };

export async function GET(req: Request, { params }: Params) {
  const m = requestT(req).t.api;

  const rl = await rateLimit(rateLimitKey(req, "cli-prompt"), RATE_LIMIT);
  if (!rl.allowed) {
    return problem(429, m.tooManyRequests, {
      kind: "rate_limited",
      retryAfter: Math.ceil((rl.resetAt - Date.now()) / 1000),
    });
  }

  const token = bearerToken(req);
  if (!token) return problem(401, CLI_PROBLEMS.unauthorized, { kind: "unauthorized" });

  const { id } = await params;
  if (!isPromptId(id)) return problem(400, CLI_PROBLEMS.invalidPromptId, { kind: "invalid" });

  try {
    const supabase = await createClientForRequest(req);
    const { data } = await supabase.auth.getUser();
    const user = data.user;
    if (!user) return problem(401, CLI_PROBLEMS.unauthorized, { kind: "unauthorized" });
    if ((await checkCliSession(token)) !== "ok") return problem(401, CLI_PROBLEMS.unauthorized, { kind: "unauthorized" });

    const result = await supabase
      .from("saved_prompts")
      .select(SAVED_PROMPT_COLUMNS)
      .eq("id", id)
      .eq("user_id", user.id)
      .maybeSingle();
    const row = orThrow(result, "saved_prompts").data;
    const prompt = row ? toDetail(row) : null;
    if (!prompt) return problem(404, CLI_PROBLEMS.promptNotFound, { kind: "notFound" });

    return NextResponse.json(
      { id: prompt.id, title: prompt.title, content: prompt.content, createdAt: prompt.createdAt },
      { headers: { "cache-control": "no-store" } }
    );
  } catch (err) {
    captureError("cli.prompt_failed", err);
    return problem(503, CLI_PROBLEMS.unavailable, { kind: "unavailable" });
  }
}
