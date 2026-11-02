import "server-only";

import { createHash, randomInt } from "node:crypto";
import { createAdminClient } from "@/server/supabase/admin";
import { USER_CODE_ALPHABET } from "@/shared/lib/cli-user-code";

// Die Wiederherstellungscodes des zweiten Faktors (Tabelle mfa_recovery_codes): der Rückweg, wenn das Gerät weg ist. Der Nutzer
// sieht sie genau einmal, gespeichert wird nur der Hash. Sie gelten nur zusammen mit dem Passwort, denn das Einlösen verlangt eine
// Sitzung. Jede Funktion wirft bei einem Datenbankfehler, die Route antwortet dann 503.

const TABLE = "mfa_recovery_codes";

/** Zehn wie bei den meisten Diensten: genug für Jahre, und einen Zettel lang. */
export const RECOVERY_CODE_COUNT = 10;

// 16 Zeichen aus 28 sind rund 77 Bit: zu viel zum Durchprobieren, auch mit einem Abzug der Tabelle. Deshalb reicht SHA-256, und ein
// Passwort-KDF brächte nichts. Das Konto steht mit im Hash, damit gleiche Codes bei zwei Konten nicht auffallen.
const CODE_CHARS = 16;
const GROUP_CHARS = 4;

function hashCode(userId: string, code: string): string {
  return createHash("sha256").update(`${userId}:${code}`).digest("hex");
}

function newCode(): string {
  let code = "";
  for (let i = 0; i < CODE_CHARS; i += 1) code += USER_CODE_ALPHABET[randomInt(USER_CODE_ALPHABET.length)];
  return code;
}

const formatCode = (code: string) => code.match(new RegExp(`.{${GROUP_CHARS}}`, "g"))!.join("-");

/** Was getippt wurde, ohne Trennzeichen und in Grossbuchstaben, oder null, wenn es kein Code sein kann. */
export function normalizeRecoveryCode(raw: string): string | null {
  const code = raw.toUpperCase().replace(/[\s-]/g, "");
  if (code.length !== CODE_CHARS || [...code].some((c) => !USER_CODE_ALPHABET.includes(c))) return null;
  return code;
}

/** Ersetzt alle Codes dieses Kontos und gibt die neuen zurück, zum einzigen Mal, formatiert zum Abschreiben. */
export async function replaceRecoveryCodes(userId: string): Promise<string[]> {
  await deleteRecoveryCodes(userId);
  const codes = Array.from({ length: RECOVERY_CODE_COUNT }, newCode);
  const { error } = await createAdminClient()
    .from(TABLE)
    .insert(codes.map((code) => ({ user_id: userId, code_hash: hashCode(userId, code) })));
  if (error) throw new Error(`mfa_recovery_codes insert: ${error.message}`);
  return codes.map(formatCode);
}

/**
 * Löst einen Code ein: ein einziges Update, das nur eine offene Zeile dieses Kontos trifft. Derselbe Code gilt nur einmal, auch bei
 * zwei gleichzeitigen Anfragen. `false` für alles, was kein offener Code dieses Kontos ist.
 */
export async function redeemRecoveryCode(userId: string, raw: string): Promise<boolean> {
  const code = normalizeRecoveryCode(raw);
  if (!code) return false;
  const { data, error } = await createAdminClient()
    .from(TABLE)
    .update({ used_at: new Date().toISOString() })
    .eq("user_id", userId)
    .eq("code_hash", hashCode(userId, code))
    .is("used_at", null)
    .select("id");
  if (error) throw new Error(`mfa_recovery_codes redeem: ${error.message}`);
  return (data?.length ?? 0) > 0;
}

/** Wie viele Codes noch offen sind, für die Einstellungen. */
export async function countRecoveryCodes(userId: string): Promise<number> {
  const { count, error } = await createAdminClient()
    .from(TABLE)
    .select("id", { count: "exact", head: true })
    .eq("user_id", userId)
    .is("used_at", null);
  if (error) throw new Error(`mfa_recovery_codes count: ${error.message}`);
  return count ?? 0;
}

export async function deleteRecoveryCodes(userId: string): Promise<void> {
  const { error } = await createAdminClient().from(TABLE).delete().eq("user_id", userId);
  if (error) throw new Error(`mfa_recovery_codes delete: ${error.message}`);
}
