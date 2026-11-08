import { NextResponse } from "next/server";
import { problem } from "@/server/http/api-problem";
import { bearerToken } from "@/server/supabase/bearer";
import { createClientForRequest } from "@/server/supabase/server";
import { orThrow } from "@/server/supabase/query";
import { rateLimit, rateLimitKey } from "@/server/security/rate-limit";
import { requestT } from "@/server/i18n";
import { CLI_PROBLEMS } from "@/server/cli-login/messages";
import { checkCliSession } from "@/server/cli-login/sessions";
import {
  SAVED_PROMPT_COLUMNS,
  likePattern,
  parseListLimit,
  parseQuery,
  toListItems,
} from "@/server/cli-login/saved-prompts";
import { captureError } from "@/shared/lib/observability";

export const runtime = "nodejs";

// Die gespeicherten Prompts des Kontos für das Terminal, neueste zuerst: der MCP-Server des Programms bietet sie
// einer anderen KI an (list_saved_prompts). Nur lesen, nur per Bearer, wie api/cli/me. Gelesen wird über die
// RLS-Sitzung des Nutzers und dazu ausdrücklich nach `user_id`.
//
// `limit`: Standard 20, eine Zahl außerhalb von 1 bis 50 wird geklemmt, keine Zahl ist 400 `invalid`.
// `q`: höchstens 200 Zeichen (länger 400 `invalid`), sucht ohne Gross/Klein in Titel und Prompttext. Je Spalte
// eine eigene Abfrage mit `ilike`, der Suchtext steht nie in einem `.or(...)` (saved-prompts.ts, likePattern).
const RATE_LIMIT = { limit: 120, windowMs: 10 * 60 * 1000 };

export async function GET(req: Request) {
  const m = requestT(req).t.api;

  const rl = await rateLimit(rateLimitKey(req, "cli-prompts"), RATE_LIMIT);
  if (!rl.allowed) {
    return problem(429, m.tooManyRequests, {
      kind: "rate_limited",
      retryAfter: Math.ceil((rl.resetAt - Date.now()) / 1000),
    });
  }

  const token = bearerToken(req);
  if (!token) return problem(401, CLI_PROBLEMS.unauthorized, { kind: "unauthorized" });

  const params = new URL(req.url).searchParams;
  const limit = parseListLimit(params.get("limit"));
  const q = parseQuery(params.get("q"));
  if (limit === null || q === null) return problem(400, CLI_PROBLEMS.invalidQuery, { kind: "invalid" });

  try {
    const supabase = await createClientForRequest(req);
    const { data } = await supabase.auth.getUser();
    const user = data.user;
    if (!user) return problem(401, CLI_PROBLEMS.unauthorized, { kind: "unauthorized" });
    if ((await checkCliSession(token)) !== "ok") return problem(401, CLI_PROBLEMS.unauthorized, { kind: "unauthorized" });

    const query = () =>
      supabase
        .from("saved_prompts")
        .select(SAVED_PROMPT_COLUMNS)
        .eq("user_id", user.id)
        .order("created_at", { ascending: false });

    const results = q
      ? await Promise.all([
          query().ilike("outputs->>title", likePattern(q)).limit(limit),
          query().ilike("outputs->>prompt", likePattern(q)).limit(limit),
        ])
      : [await query().limit(limit)];
    const rows = results.flatMap((result) => orThrow(result, "saved_prompts").data ?? []);

    return NextResponse.json(
      { prompts: toListItems(rows, limit, q) },
      { headers: { "cache-control": "no-store" } }
    );
  } catch (err) {
    captureError("cli.prompts_failed", err);
    return problem(503, CLI_PROBLEMS.unavailable, { kind: "unavailable" });
  }
}
