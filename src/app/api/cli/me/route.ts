import { NextResponse } from "next/server";
import { problem } from "@/server/http/api-problem";
import { bearerToken } from "@/server/supabase/bearer";
import { createClientForRequest } from "@/server/supabase/server";
import { orThrow } from "@/server/supabase/query";
import { hasZaiConsent } from "@/server/consent";
import { llmConfig } from "@/server/llm";
import { rateLimit, rateLimitKey } from "@/server/security/rate-limit";
import { requestT } from "@/server/i18n";
import { CLI_PROBLEMS } from "@/server/cli-login/messages";
import { checkCliSession } from "@/server/cli-login/sessions";
import { requiresOwnKey, resolvePlan } from "@/shared/lib/plans";
import { freePromptsLeft as freePromptsLeftOf } from "@/server/free-trial";
import { captureError } from "@/shared/lib/observability";

export const runtime = "nodejs";

// Das Terminal fragt beim Start, wer angemeldet ist und ob der nächste Zug überhaupt laufen kann. So
// steht der Hinweis auf den fehlenden Key oder die Zustimmung im Startbild und nicht erst als Fehler
// nach der ersten Idee, wie bei den Chat-Seiten (getNeedsOwnKey). Nur lesen, und nur per Bearer: im
// Browser kennt die Seite das alles schon. `getUser()` beim Auth-Server entscheidet, ein gelöschtes
// Konto ist also sofort draußen. Der Key selbst bleibt unangetastet, gelesen wird nur `provider`.
// Das Ratenlimit je Adresse steht vor dem Auth-Server und bremst nur Missbrauch.
const RATE_LIMIT = { limit: 60, windowMs: 10 * 60 * 1000 };

export async function GET(req: Request) {
  const m = requestT(req).t.api;

  const rl = await rateLimit(rateLimitKey(req, "cli-me"), RATE_LIMIT);
  if (!rl.allowed) {
    return problem(429, m.tooManyRequests, {
      kind: "rate_limited",
      retryAfter: Math.ceil((rl.resetAt - Date.now()) / 1000),
    });
  }

  const token = bearerToken(req);
  if (!token) return problem(401, CLI_PROBLEMS.unauthorized, { kind: "unauthorized" });

  try {
    const supabase = await createClientForRequest(req);
    const { data } = await supabase.auth.getUser();
    const user = data.user;
    if (!user) return problem(401, CLI_PROBLEMS.unauthorized, { kind: "unauthorized" });
    // Wie im Chat: Bearer gilt nur für ein eingetragenes Terminal bis zu seinem Höchstalter, das weiss der Auth-Server nicht.
    if ((await checkCliSession(token)) !== "ok") return problem(401, CLI_PROBLEMS.unauthorized, { kind: "unauthorized" });

    const [profile, keys] = await Promise.all([
      supabase.from("profiles").select("plan, is_admin").eq("id", user.id).maybeSingle(),
      supabase.from("user_api_keys").select("provider").eq("user_id", user.id).limit(1),
    ]);
    const { plan, isAdmin } = resolvePlan(orThrow(profile, "profiles").data);
    const hasOwnKey = (orThrow(keys, "user_api_keys").data?.length ?? 0) > 0;
    // Free ohne Key chattet im Gratis-Rahmen, solange er reicht (server/free-trial.ts).
    const onFreeTrial = requiresOwnKey(plan, isAdmin, hasOwnKey);
    const freePromptsLeft = onFreeTrial ? ((await freePromptsLeftOf(user.id)) ?? 0) : null;
    const needsOwnKey = onFreeTrial && freePromptsLeft === 0;

    return NextResponse.json(
      {
        email: user.email ?? null,
        plan,
        hasOwnKey,
        needsOwnKey,
        ...(freePromptsLeft === null ? {} : { freePromptsLeft }),
        // Dieselbe Bedingung wie im Chat (model-call.ts): nur wer wirklich auf Z.ai läuft, muss zustimmen.
        needsConsent:
          !hasOwnKey && !needsOwnKey && llmConfig()?.provider === "zai" && !hasZaiConsent(user.app_metadata),
      },
      { headers: { "cache-control": "no-store" } }
    );
  } catch (err) {
    captureError("cli.me_failed", err);
    return problem(503, CLI_PROBLEMS.unavailable, { kind: "unavailable" });
  }
}
