import { NextResponse } from "next/server";
import { z } from "zod";
import {
  rateLimit,
  rateLimitKey,
  reserveMonthlyQuota,
  reserveServerKeyCall,
} from "@/server/security/rate-limit";
import { createClient } from "@/server/supabase/server";
import { createAdminClient } from "@/server/supabase/admin";
import { llmConfig } from "@/server/llm";
import { getUserOverride } from "@/server/byok";
import { effectiveLimits, type PlanKey } from "@/shared/lib/plans";
import { problem } from "@/server/http/api-problem";
import {
  MAX_SMALL_BODY_BYTES,
  RequestBodyTooLargeError,
  readJsonBody,
} from "@/server/http/request-body";
import { captureError, logEvent } from "@/shared/lib/observability";
import { analyzeProjectBrain, BrainAnalysisError } from "@/server/brain/analyze";
import { GithubImportError, parseGithubRepoUrl } from "@/server/brain/github";
import { collectBrainSources } from "@/features/projects/lib/brain-sources";
import type { ProjectBrainFacts } from "@/shared/lib/project-brain";

export const runtime = "nodejs";
// Wie /api/chat: eine Analyse liest bis zu 14 Repo-Dateien plus die
// Projektdateien und macht danach einen Modellaufruf. Im Normalfall sind das
// wenige Sekunden (live gemessen: rund 4,5 s für den Modellteil), aber ein
// grosses Repo plus Screenshots kann deutlich darüber liegen, und ein Timeout
// mitten drin hinterlässt einen „analyzing"-Status, den erst der
// Zeitablauf-Fallback in project-brain.ts wieder auflöst.
export const maxDuration = 300;

// Die Analyse des Projekt-Gedächtnisses.
//
// ─── Warum die Analyse synchron in der Route läuft ─────────────────────────
// Das Projekt hat kein Job-System (kein Cron, keine Queue, siehe das
// Vercel-Audit vom 01.08.), und eines nur hierfür einzuführen wäre ein
// grösserer Eingriff als das Feature selbst. Die Analyse ist ein einzelner
// Modellaufruf und dauert typischerweise Sekunden — das ist eine Wartezeit,
// die eine UI mit Spinner ehrlich abbilden kann. Der Preis dafür: reisst der
// Request ab, bleibt der Status auf „analyzing" stehen, denn der Prozess, der
// ihn aufräumen müsste, ist genau der, der weg ist. Statt dafür einen Cron zu
// bauen, entscheidet die Leseseite über den Zeitablauf (isAnalysisRunning),
// und „Neu analysieren" ist immer erlaubt.
//
// ─── Warum die Schreibzugriffe über den Service-Role-Client laufen ─────────
// project_brains hat bewusst nur ein select-Grant (migration 0037): der
// einzige Wert dieser Tabelle ist, dass die Fakten aus echten Quellen
// stammen, und ein insert/update-Grant für `authenticated` würde bedeuten,
// dass sich jeder sein „analysiertes" Ergebnis aus der Browser-Konsole
// schreiben kann. Der Preis ist, dass RLS hier nicht mehr greift — deshalb
// prüft die Route die Eigentümerschaft selbst, bevor sie irgendetwas
// schreibt, und jeder Schreibzugriff filtert zusätzlich auf user_id.

const brainRequestSchema = z.object({
  // null = ein hinterlegtes Repo wieder entfernen; weggelassen = das bereits
  // gespeicherte behalten.
  repoUrl: z.string().trim().max(300).nullish(),
});

type Params = { params: Promise<{ id: string }> };

/**
 * Eine Analyse ist ein Modellaufruf wie ein Chat-Zug und zählt deshalb gegen
 * dasselbe Monatskontingent — mit demselben Redis-Schlüssel, nicht mit einem
 * eigenen. Ein zweiter Zähler wäre ein zweites Versprechen, das die Preisseite
 * gar nicht macht („400 Nachrichten pro Monat"), und der Nutzer müsste
 * plötzlich zwei Budgets im Kopf haben.
 *
 * Der Aufruf ist beim Input teurer als ein Chat-Zug (bis zu 60 000 Zeichen
 * Quellen), beim Output deutlich billiger (rund 250 Token statt bis zu 6144).
 * Live gemessen liegt eine Textanalyse bei rund 0,0005 $ — in derselben
 * Grössenordnung wie ein Chat-Zug, also ist eine Einheit die ehrliche
 * Verrechnung.
 */
function quotaKey(userId: string): string {
  const now = new Date();
  return `chat-quota:${userId}:${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, "0")}`;
}

export async function POST(req: Request, { params }: Params) {
  const { id: projectId } = await params;

  // 1. Session vor dem Body (Security-Audit H-3).
  let supabase: Awaited<ReturnType<typeof createClient>>;
  try {
    supabase = await createClient();
  } catch {
    return problem(503, "Die Analyse ist gerade nicht erreichbar, bitte versuch es später erneut.");
  }

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return problem(401, "Anmeldung erforderlich.");
  const userId = user.id;

  let body: unknown;
  try {
    body = await readJsonBody(req, MAX_SMALL_BODY_BYTES);
  } catch (err) {
    if (err instanceof RequestBodyTooLargeError) return problem(413, "Die Anfrage ist zu gross.");
    return problem(400, "Die Anfrage konnte nicht gelesen werden.");
  }

  const parsed = brainRequestSchema.safeParse(body ?? {});
  if (!parsed.success) return problem(400, "Die Anfrage konnte nicht verarbeitet werden.");

  // 2. Eigentümerschaft. Explizites user_id neben RLS, hier nicht nur
  //    Defense-in-depth: die Schreibzugriffe unten laufen über den
  //    Service-Role-Client, für den RLS gar nicht greift, also ist das hier
  //    die einzige Stelle, die „gehört dir" überhaupt noch feststellt.
  const { data: project } = await supabase
    .from("projects")
    .select("name")
    .eq("id", projectId)
    .eq("user_id", userId)
    .maybeSingle<{ name: string }>();
  // Fremd und nicht vorhanden bekommen dieselbe Antwort — sonst verrät die
  // Route, welche Projekt-IDs existieren.
  if (!project) return problem(404, "Projekt nicht gefunden.");

  // 3. Repo-URL auflösen: mitgeschickte gewinnt, sonst die gespeicherte.
  const admin = createAdminClient();
  const { data: existing } = await admin
    .from("project_brains")
    .select("repo_url")
    .eq("project_id", projectId)
    .eq("user_id", userId)
    .maybeSingle<{ repo_url: string | null }>();

  let repoUrl: string | null = existing?.repo_url ?? null;
  if (parsed.data.repoUrl !== undefined) {
    const raw = parsed.data.repoUrl;
    if (raw === null || raw === "") {
      repoUrl = null;
    } else {
      const ref = parseGithubRepoUrl(raw);
      if (!ref) {
        return problem(400, "Das sieht nicht nach einem öffentlichen GitHub-Repository aus.", {
          code: "repo_invalid_url",
        });
      }
      repoUrl = ref.url;
    }
  }

  // 4. Plan, BYOK, Kontingente — dieselbe Kette wie /api/chat, weil dahinter
  //    derselbe Kostentreiber steht: ein Modellaufruf auf dem Server-Key.
  const [{ data: profile }, override] = await Promise.all([
    supabase.from("profiles").select("plan, is_admin").eq("id", userId).maybeSingle(),
    getUserOverride(userId),
  ]);
  const isAdmin = profile?.is_admin ?? false;
  const rawPlan = (profile?.plan as string | undefined) ?? "free";
  const plan: PlanKey = rawPlan === "pro" || rawPlan === "team" ? rawPlan : "free";
  const limits = effectiveLimits(plan, isAdmin);

  const reservations: (() => Promise<void>)[] = [];
  const releaseReservations = async () => {
    for (const release of reservations) await release();
    reservations.length = 0;
  };

  if (!override) {
    if (limits.chatMessages <= 0) {
      return problem(
        403,
        "Free läuft nur mit deinem eigenen KI-Key. Hinterleg einen Anthropic-, OpenAI- oder Gemini-Key in den Einstellungen, oder wechsle zu Pro.",
        { kind: "byokRequired", plan }
      );
    }
    const reservation = await reserveMonthlyQuota(quotaKey(userId), limits.chatMessages);
    if (reservation && !reservation.allowed) {
      await reservation.release();
      return problem(
        403,
        `Monatslimit erreicht, dein Plan (${plan}) erlaubt ${limits.chatMessages} Modell-Aufrufe pro Monat. Nächsten Monat geht's weiter, oder hinterlege einen eigenen API-Key in den Einstellungen.`,
        { kind: "chatMessages", limit: limits.chatMessages, plan }
      );
    }
    if (reservation) reservations.push(reservation.release);
  }

  // Eigenes, knappes Stundenlimit statt der 120 des Chats: eine Analyse liest
  // ein ganzes Repo und ist damit die teuerste Einzelaktion der App. Fünf pro
  // Stunde decken jedes echte Arbeitsmuster ab (man analysiert ein Projekt
  // einmal und danach, wenn sich Quellen ändern) und deckeln die
  // GitHub-Requests gleich mit.
  if (!isAdmin) {
    const rl = await rateLimit(`brain:${rateLimitKey(req, userId)}`, {
      limit: 5,
      windowMs: 60 * 60 * 1000,
    });
    if (!rl.allowed) {
      await releaseReservations();
      return problem(429, "Zu viele Analysen, bitte warte kurz und versuch es erneut.", {
        retryAfter: Math.ceil((rl.resetAt - Date.now()) / 1000),
      });
    }
  }

  if (!override) {
    const budget = await reserveServerKeyCall();
    if (budget && !budget.allowed) {
      await budget.release();
      await releaseReservations();
      return problem(
        503,
        "Die Analyse ist gerade vorübergehend nicht verfügbar. Versuch es später noch einmal, oder hinterlege einen eigenen API-Key in den Einstellungen."
      );
    }
    if (budget) reservations.push(budget.release);
  }

  // Kein Stub-Modus für die Analyse: eine erfundene Faktenliste ist schlimmer
  // als gar keine, weil sie danach in JEDEN Prompt dieses Projekts wandert.
  // Deshalb hier — anders als im Chat — auch in der Entwicklung eine klare
  // Absage statt einer Platzhalterantwort.
  if (!llmConfig() && !override) {
    await releaseReservations();
    return problem(
      503,
      "Die Analyse ist gerade nicht eingerichtet. Hinterlege einen eigenen API-Key in den Einstellungen, dann läuft sie sofort."
    );
  }

  // 5. Status auf „läuft" setzen, damit ein Reload den Spinner zeigt statt
  //    einen scheinbar unveränderten Leerzustand.
  const startedAt = Date.now();
  await admin.from("project_brains").upsert(
    {
      project_id: projectId,
      user_id: userId,
      status: "analyzing",
      repo_url: repoUrl,
      error_code: null,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "project_id" }
  );

  try {
    const collected = await collectBrainSources(supabase, userId, projectId, {
      projectName: project.name,
      repoUrl,
      signal: req.signal,
    });

    const { facts, model } = await analyzeProjectBrain(collected.input, {
      override: override ?? undefined,
      signal: req.signal,
    });

    const analyzedAt = new Date().toISOString();
    await admin
      .from("project_brains")
      .update({
        status: "ready",
        facts,
        sources: collected.sources,
        source_digest: collected.digest,
        repo_url: collected.repoUrl,
        repo_ref: collected.repoRef,
        model,
        error_code: null,
        analyzed_at: analyzedAt,
        updated_at: analyzedAt,
      })
      .eq("project_id", projectId)
      .eq("user_id", userId);

    logEvent("brain.analyzed", {
      userId,
      projectId,
      byok: Boolean(override),
      model,
      sources: collected.sources.length,
      images: collected.input.images.length,
      hasRepo: Boolean(collected.input.repo),
      confidence: facts.confidence,
      latencyMs: Date.now() - startedAt,
    });

    return NextResponse.json({
      status: "ready" as const,
      facts: facts satisfies ProjectBrainFacts,
      sources: collected.sources,
      sourceDigest: collected.digest,
      repoUrl: collected.repoUrl,
      model,
      analyzedAt,
    });
  } catch (err) {
    // Der Aufruf hat nichts Verwertbares geliefert, also auch nichts gekostet,
    // was jemandem angerechnet werden sollte — dieselbe Logik wie im Chat.
    await releaseReservations();

    const code = errorCode(err);
    captureError("brain.analysis_failed", err, {
      userId,
      projectId,
      code,
      byok: Boolean(override),
      latencyMs: Date.now() - startedAt,
    });

    await admin
      .from("project_brains")
      .update({ status: "failed", error_code: code, updated_at: new Date().toISOString() })
      .eq("project_id", projectId)
      .eq("user_id", userId);

    return problem(502, describeBrainFailure(code), { code });
  }
}

/** Löscht das Gedächtnis eines Projekts wieder. */
export async function DELETE(_req: Request, { params }: Params) {
  const { id: projectId } = await params;

  let supabase: Awaited<ReturnType<typeof createClient>>;
  try {
    supabase = await createClient();
  } catch {
    return problem(503, "Gerade nicht erreichbar, bitte versuch es später erneut.");
  }

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return problem(401, "Anmeldung erforderlich.");

  // Auch hier zuerst die Eigentümerschaft über den RLS-gebundenen Client, weil
  // das Löschen darunter am Service-Role-Client hängt.
  const { data: project } = await supabase
    .from("projects")
    .select("id")
    .eq("id", projectId)
    .eq("user_id", user.id)
    .maybeSingle();
  if (!project) return problem(404, "Projekt nicht gefunden.");

  const admin = createAdminClient();
  const { error } = await admin
    .from("project_brains")
    .delete()
    .eq("project_id", projectId)
    .eq("user_id", user.id);

  if (error) {
    captureError("brain.delete_failed", error, { userId: user.id, projectId });
    return problem(500, "Konnte nicht gelöscht werden. Bitte versuch es erneut.");
  }

  return NextResponse.json({ status: "idle" as const });
}

/** Stabiler Code aus dem geworfenen Fehler, nie dessen Wortlaut (M-1). */
function errorCode(err: unknown): string {
  if (err instanceof GithubImportError) return err.code;
  if (err instanceof BrainAnalysisError) return err.code;
  return "analysis_failed";
}

/** Deutscher, nicht-leckender Text zum Code (dieselbe Linie wie QA-Befund U-4). */
function describeBrainFailure(code: string): string {
  switch (code) {
    case "repo_not_found":
      return "Das Repository konnte nicht gelesen werden. Ist es öffentlich und die Adresse richtig?";
    case "repo_rate_limited":
      return "GitHub lässt gerade keine weiteren Abfragen zu. Versuch es in einer Stunde nochmal.";
    case "repo_empty":
      return "In diesem Repository sind keine analysierbaren Dateien.";
    case "repo_unavailable":
      return "GitHub ist gerade nicht erreichbar. Versuch es in ein paar Minuten nochmal.";
    case "analysis_no_sources":
      return "Es gibt noch nichts zu analysieren. Lade Dateien hoch oder hinterlege ein GitHub-Repository.";
    case "analysis_unparsable":
      return "Die Analyse hat kein verwertbares Ergebnis geliefert. Versuch es nochmal.";
    default:
      return "Die Analyse ist fehlgeschlagen. Versuch es nochmal, oder später erneut.";
  }
}
