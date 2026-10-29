import "server-only";

import { createAdminClient } from "@/server/supabase/admin";
import {
  DEVICE_REQUEST_TTL_MS,
  hashDeviceCode,
  newDeviceCode,
  newUserCode,
} from "@/server/cli-login/codes";

// Die Anfragen der Geräte-Anmeldung in cli_device_requests (Migration 0050). Nur der Server liest und
// schreibt, mit dem Service-Role-Client: anon und authenticated haben auf der Tabelle kein Recht. Jede
// Funktion wirft bei einem Datenbankfehler (die Routen antworten dann 503), außer dem Aufräumen.

const TABLE = "cli_device_requests";

/** Abgelaufene Zeilen bleiben einen Tag liegen (Fehlersuche), dann räumt das Anlegen sie weg. */
const KEEP_EXPIRED_MS = 24 * 60 * 60 * 1000;

const UNIQUE_VIOLATION = "23505";
const MAX_CODE_ATTEMPTS = 3;

export type DeviceRequest = {
  id: string;
  status: "pending" | "approved" | "denied" | "consumed";
  user_id: string | null;
  expires_at: string;
  last_polled_at: string | null;
};

/** Legt eine Anfrage an. Gibt die beiden Codes im Klartext zurück, zum einzigen Mal. */
export async function createDeviceRequest(clientName: string): Promise<{
  deviceCode: string;
  userCode: string;
  expiresAt: string;
}> {
  const admin = createAdminClient();

  // Best effort: ein Fehler beim Aufräumen darf das Anmelden nicht aufhalten.
  await admin
    .from(TABLE)
    .delete()
    .lt("expires_at", new Date(Date.now() - KEEP_EXPIRED_MS).toISOString());

  // Zwei gleiche Nutzer-Codes sind bei 28^8 Möglichkeiten und einer Handvoll offener Anfragen
  // unwahrscheinlich, aber die Spalte ist eindeutig, und ein Zusammenstoß wäre sonst ein 500.
  for (let attempt = 0; attempt < MAX_CODE_ATTEMPTS; attempt += 1) {
    const deviceCode = newDeviceCode();
    const userCode = newUserCode();
    const expiresAt = new Date(Date.now() + DEVICE_REQUEST_TTL_MS).toISOString();
    const { error } = await admin.from(TABLE).insert({
      device_code_hash: hashDeviceCode(deviceCode),
      user_code: userCode,
      client_name: clientName,
      expires_at: expiresAt,
    });
    if (!error) return { deviceCode, userCode, expiresAt };
    if (error.code !== UNIQUE_VIOLATION) throw new Error(`cli_device_requests insert: ${error.message}`);
  }
  throw new Error("cli_device_requests insert: Nutzer-Code mehrfach vergeben");
}

/** Die offene, noch gültige Anfrage zu diesem Nutzer-Code, für die Bestätigungsseite. */
export async function findPendingRequest(
  userCode: string
): Promise<{ clientName: string; createdAt: string } | null> {
  const { data, error } = await createAdminClient()
    .from(TABLE)
    .select("client_name, created_at")
    .eq("user_code", userCode)
    .eq("status", "pending")
    .gt("expires_at", new Date().toISOString())
    .maybeSingle();
  if (error) throw new Error(`cli_device_requests select: ${error.message}`);
  return data ? { clientName: data.client_name, createdAt: data.created_at } : null;
}

/**
 * Hält fest, was der Nutzer auf der Bestätigungsseite entschieden hat. Ein einziges Update, das nur
 * eine offene, gültige Anfrage trifft: zwei Entscheidungen auf denselben Code, oder eine nach Ablauf,
 * ändern nichts. `false`, wenn keine Zeile getroffen wurde.
 */
export async function decideRequest(
  userCode: string,
  userId: string,
  decision: "approved" | "denied"
): Promise<boolean> {
  const { data, error } = await createAdminClient()
    .from(TABLE)
    .update({ status: decision, user_id: userId })
    .eq("user_code", userCode)
    .eq("status", "pending")
    .gt("expires_at", new Date().toISOString())
    .select("id");
  if (error) throw new Error(`cli_device_requests update: ${error.message}`);
  return (data?.length ?? 0) > 0;
}

/** Die Anfrage zu einem Geräte-Code (nach Hash), oder null. */
export async function findRequestByDeviceCode(deviceCode: string): Promise<DeviceRequest | null> {
  const { data, error } = await createAdminClient()
    .from(TABLE)
    .select("id, status, user_id, expires_at, last_polled_at")
    .eq("device_code_hash", hashDeviceCode(deviceCode))
    .maybeSingle();
  if (error) throw new Error(`cli_device_requests select: ${error.message}`);
  return (data as DeviceRequest | null) ?? null;
}

/** Merkt sich, wann das Terminal zuletzt nachgefragt hat (für slow_down). Best effort. */
export async function markPolled(id: string): Promise<void> {
  await createAdminClient()
    .from(TABLE)
    .update({ last_polled_at: new Date().toISOString() })
    .eq("id", id);
}

/**
 * Holt eine freigegebene Anfrage ab: ein einziges Update von approved auf consumed, das nur trifft, wenn
 * die Anfrage noch approved und gültig ist. Bei zwei gleichzeitigen Abfragen bekommt genau eine die
 * Nutzer-ID zurück, die andere null. Danach ist der Geräte-Code verbraucht, auch wenn das Ausstellen der
 * Sitzung scheitert: lieber neu anmelden als zweimal ausliefern.
 */
export async function claimApprovedRequest(id: string): Promise<string | null> {
  const { data, error } = await createAdminClient()
    .from(TABLE)
    .update({ status: "consumed" })
    .eq("id", id)
    .eq("status", "approved")
    .gt("expires_at", new Date().toISOString())
    .select("user_id");
  if (error) throw new Error(`cli_device_requests claim: ${error.message}`);
  return data?.[0]?.user_id ?? null;
}
