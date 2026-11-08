import "server-only";

import { captureError } from "@/shared/lib/observability";
import { logSecurityEvent, safeSecurityContext } from "@/server/security/security-log";
import { createAdminClient } from "@/server/supabase/admin";
import type { Json } from "@/shared/supabase/database.types";

// Vorgänge, die länger bleiben müssen als das Log: Änderungen an Keys und Einwilligung, das Löschen eines Kontos. Sie
// stehen zusätzlich in public.security_events, einer Tabelle nur für den Server und nur zum Anhängen. Nach 180 Tagen
// löscht sie ein Datenbank-Job (docs/SETUP.md, "Sicherheitsprotokoll"). Planwechsel stehen schon in billing_events.

export type DurableSecurityEvent =
  | "api_key.saved"
  | "api_key.activated"
  | "api_key.removed"
  | "consent.zai_granted"
  | "consent.zai_withdrawn"
  | "account.deleted"
  | "cli.login_approved"
  | "cli.login_denied"
  | "cli.session_issued"
  | "cli.session_revoked"
  | "mfa.enabled"
  | "mfa.disabled"
  | "mfa.recovery_used"
  | "mfa.recovery_codes_renewed"
  | "prompt.shared"
  | "prompt.unshared";

type Details = Record<string, string | number | boolean | null>;

/**
 * Schreibt den Vorgang ins Log und in die Tabelle. Wirft nie: scheitert das Protokoll, bleibt die Aktion des Nutzers
 * trotzdem gültig, und der Fehler steht im Log. Wird abgewartet, denn eine Funktion auf Vercel endet mit der Antwort.
 */
export async function recordSecurityEvent(
  event: DurableSecurityEvent,
  userId: string,
  details: Details = {}
): Promise<void> {
  logSecurityEvent(event, { userId, ...details });
  try {
    const { error } = await createAdminClient()
      .from("security_events")
      .insert({ event, user_id: userId, details: safeSecurityContext(details) as NonNullable<Json> });
    if (error) throw error;
  } catch (err) {
    captureError("security_events.write_failed", err, { event, userId });
  }
}
