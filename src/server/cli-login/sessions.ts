import "server-only";

import { recordSecurityEvent } from "@/server/security/security-events";
import { createAdminClient } from "@/server/supabase/admin";

// Die Terminal-Sitzungen eines Kontos (Tabelle cli_sessions): sichtbar, einzeln widerrufbar, mit Höchstalter. Das Terminal
// behält eine echte Supabase-Sitzung, einen eigenen Token-Typ gibt es bewusst nicht (docs/SETUP.md, "Terminal-Anmeldung").
// Nur der Server liest und schreibt. Jede Funktion wirft bei einem Datenbankfehler, die Routen antworten dann 503.

const TABLE = "cli_sessions";

/**
 * So lange bleibt ein Terminal höchstens angemeldet, danach meldet man es neu an (ein Code, ein Klick). Die Sitzung
 * lässt sich nicht verlängern: Time-box von Supabase Auth gibt es erst im Pro-Tarif, deshalb steht das Ende in der
 * Tabelle, und ein Job in der Datenbank beendet abgelaufene Sitzungen (Migration, prune_cli_login).
 */
export const CLI_SESSION_MAX_AGE_MS = 30 * 24 * 60 * 60 * 1000;

/** "Zuletzt benutzt" reicht grob, ein Schreibzugriff je Chat-Zug nicht. */
const LAST_USED_RESOLUTION_MS = 15 * 60 * 1000;

export type CliSessionRow = {
  id: string;
  clientName: string;
  createdAt: string;
  lastUsedAt: string;
  expiresAt: string;
};

/**
 * Sitzung und Konto aus dem JWT, ohne die Signatur zu prüfen: das Token kommt gerade vom Auth-Server, oder getUser() hat
 * es gerade geprüft. `null` bei allem, was kein solches Token ist.
 */
function claimsOfToken(accessToken: string): { sessionId: string; userId: string } | null {
  try {
    const payload = JSON.parse(Buffer.from(accessToken.split(".")[1] ?? "", "base64url").toString("utf8"));
    if (typeof payload.session_id !== "string" || typeof payload.sub !== "string") return null;
    return { sessionId: payload.session_id, userId: payload.sub };
  } catch {
    return null;
  }
}

/** Trägt eine frisch ausgestellte Sitzung ein. `false`, wenn das Token keine Sitzung nennt oder das Eintragen scheitert. */
export async function registerCliSession(accessToken: string, clientName: string): Promise<boolean> {
  const claims = claimsOfToken(accessToken);
  if (!claims) return false;
  const { error } = await createAdminClient().from(TABLE).insert({
    session_id: claims.sessionId,
    user_id: claims.userId,
    client_name: clientName,
    expires_at: new Date(Date.now() + CLI_SESSION_MAX_AGE_MS).toISOString(),
  });
  return !error;
}

/**
 * Beendet genau diese Sitzung bei Supabase Auth. `false`, wenn sie nicht diesem Konto gehört, schon weg oder gar keine
 * Terminal-Sitzung ist: die Funktion in der Datenbank trifft nur Einträge aus cli_sessions, nie einen Browser.
 */
export async function endCliSession(
  sessionId: string,
  userId: string,
  via: "settings" | "max_age"
): Promise<boolean> {
  const { data, error } = await createAdminClient().rpc("end_cli_session", {
    target_session: sessionId,
    target_user: userId,
  });
  if (error) throw new Error(`end_cli_session: ${error.message}`);
  if (!data) return false;
  await recordSecurityEvent("cli.session_revoked", userId, { via });
  return true;
}

export type CliSessionVerdict = "ok" | "unknown" | "expired";

/**
 * Darf diese Sitzung weiterarbeiten? Für den Chat und das Erneuern, nachdem der Auth-Server das Token anerkannt hat.
 *   "unknown"  nicht eingetragen: kein Terminal, etwa das Token einer Browser-Sitzung
 *   "expired"  älter als das Höchstalter, wird hier auch gleich beendet
 */
export async function checkCliSession(accessToken: string): Promise<CliSessionVerdict> {
  const claims = claimsOfToken(accessToken);
  if (!claims) return "unknown";

  const admin = createAdminClient();
  const { data, error } = await admin
    .from(TABLE)
    .select("expires_at, last_used_at")
    .eq("session_id", claims.sessionId)
    .eq("user_id", claims.userId)
    .maybeSingle();
  if (error) throw new Error(`cli_sessions select: ${error.message}`);
  if (!data) return "unknown";

  if (new Date(data.expires_at).getTime() <= Date.now()) {
    await endCliSession(claims.sessionId, claims.userId, "max_age");
    return "expired";
  }

  if (Date.now() - new Date(data.last_used_at).getTime() >= LAST_USED_RESOLUTION_MS) {
    // Best effort: "zuletzt benutzt" darf nie einen Chat-Zug aufhalten.
    await admin
      .from(TABLE)
      .update({ last_used_at: new Date().toISOString() })
      .eq("session_id", claims.sessionId)
      .eq("user_id", claims.userId);
  }
  return "ok";
}

/** Die angemeldeten Terminals dieses Kontos, neueste zuerst, ohne schon abgelaufene. */
export async function listCliSessions(userId: string): Promise<CliSessionRow[]> {
  const { data, error } = await createAdminClient()
    .from(TABLE)
    .select("session_id, client_name, created_at, last_used_at, expires_at")
    .eq("user_id", userId)
    .gt("expires_at", new Date().toISOString())
    .order("created_at", { ascending: false });
  if (error) throw new Error(`cli_sessions select: ${error.message}`);
  return (data ?? []).map((row) => ({
    id: row.session_id,
    clientName: row.client_name,
    createdAt: row.created_at,
    lastUsedAt: row.last_used_at,
    expiresAt: row.expires_at,
  }));
}
