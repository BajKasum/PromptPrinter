import { createClient } from "@/server/supabase/server";
import { problem } from "@/server/http/api-problem";
import { rateLimit, rateLimitKey } from "@/server/security/rate-limit";
import {
  PROFILE_COLUMNS,
  accountExportStream,
  buildAccountSection,
  exportFilename,
} from "@/server/account-export";
import { requestT } from "@/server/i18n";
import { captureError, logEvent } from "@/shared/lib/observability";

export const runtime = "nodejs";
// Ein gestreamter Export grosser Konten darf länger laufen als eine
// gewöhnliche Antwort; am Ende ist es eine Folge von Seitenabfragen.
export const maxDuration = 120;

/**
 * Alle Daten des angemeldeten Kontos als JSON-Download (Betriebs-Audit
 * 04.10.2026). Was drin ist und warum nicht mehr, steht in
 * src/server/account-export.ts.
 *
 * GET statt POST, mit Absicht: der Knopf in den Einstellungen ist ein
 * gewöhnlicher Link mit `download`, den der Browser selbst als Datei ablegt
 * (Fortschritt, Abbruch, Fehleranzeige inklusive), ohne dass die Datei erst
 * durch den Speicher einer Seite laufen müsste. Dass ein GET hier trotzdem
 * keine Nebenwirkung hat, sichern zwei Dinge: er liest nur, und eine
 * seitenübergreifende Anfrage (Sec-Fetch-Site: cross-site) lehnt die Route ab.
 * Eine fremde Seite könnte sonst den Browser eines Nutzers eine Datei mit
 * dessen Daten laden lassen; lesen könnte sie sie nicht, aber es ist ein
 * Download, den niemand ausgelöst hat.
 */
export async function GET(req: Request) {
  const { t } = requestT(req);
  const m = t.api;

  if (req.headers.get("sec-fetch-site") === "cross-site") {
    return problem(403, "Cross-site export requests are not allowed.");
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  // Die Kennung kommt aus der geprüften Sitzung, nie aus der Anfrage.
  if (!user) return problem(401, m.accountNotSignedIn);

  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select(PROFILE_COLUMNS)
    .eq("id", user.id)
    .maybeSingle();
  if (profileError) {
    captureError("account.export_profile_failed", profileError, { userId: user.id });
    return problem(503, m.accountExportFailed);
  }

  // Ein Export liest viel. Wenige pro Stunde reichen jedem, der ihn wirklich
  // braucht, und halten die Route als Lastquelle klein. Wie überall: der
  // Betreiber ist ausgenommen.
  const isAdmin = (profile as { is_admin?: boolean } | null)?.is_admin ?? false;
  if (!isAdmin) {
    const rl = await rateLimit(rateLimitKey(req, user.id), { limit: 5, windowMs: 60 * 60 * 1000 });
    if (!rl.allowed) {
      return problem(429, m.tooManyRequests, {
        retryAfter: Math.ceil((rl.resetAt - Date.now()) / 1000),
      });
    }
  }

  const now = new Date();
  logEvent("account.export", { userId: user.id });

  const stream = accountExportStream({
    supabase,
    userId: user.id,
    account: buildAccountSection(user, profile as Record<string, unknown> | null),
    note: m.accountExportNote,
    now,
  });

  return new Response(stream, {
    headers: {
      "content-type": "application/json; charset=utf-8",
      "content-disposition": `attachment; filename="${exportFilename(now)}"`,
      // Persönliche Daten: nirgends zwischenspeichern, und der Browser soll den
      // Typ nicht umdeuten.
      "cache-control": "no-store",
      "x-content-type-options": "nosniff",
    },
  });
}
