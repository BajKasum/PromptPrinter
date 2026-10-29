import "server-only";

import { createClient } from "@supabase/supabase-js";
import { createAdminClient } from "@/server/supabase/admin";

// Die eigene Supabase-Sitzung der Kommandozeile. Keine selbst gebaute Art von Token: die Routen lesen
// und schreiben mit dem Client des Nutzers unter RLS, und ein Bearer-Token ist genau das Token, das
// Supabase auch dem Browser gibt. Ausgestellt wird sie ohne Mail: generateLink erzeugt einen
// Anmeldelink, dessen Hash der Server selbst einlöst (verifyOtp), der Link verlässt den Server nie.
// Das Ergebnis ist eine neue Sitzung mit eigener session_id, getrennt von der des Browsers; der Link
// ist nur einmal einlösbar. Nebenwirkung: app_metadata.provider steht danach auf "email", eigene
// Felder wie die Einwilligung in Z.ai bleiben, und die App liest provider nirgends.

export type CliSession = {
  access_token: string;
  refresh_token: string;
  /** Unix-Sekunden, wann das Access-Token abläuft. */
  expires_at: number;
  /** Sekunden, die es ab jetzt gilt. */
  expires_in: number;
  token_type: "bearer";
};

/** Ein Client ohne Sitzung und ohne Speicher: er hält nichts zwischen zwei Aufrufen. */
function anonClient() {
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });
}

function toCliSession(session: {
  access_token: string;
  refresh_token: string;
  expires_at?: number;
  expires_in: number;
}): CliSession {
  return {
    access_token: session.access_token,
    refresh_token: session.refresh_token,
    expires_at: session.expires_at ?? Math.floor(Date.now() / 1000) + session.expires_in,
    expires_in: session.expires_in,
    token_type: "bearer",
  };
}

/**
 * Stellt dem Konto `userId` eine Sitzung für die Kommandozeile aus. `null`, wenn das nicht gelingt
 * (Konto weg, keine E-Mail-Adresse, der Auth-Server lehnt ab): der Aufrufer meldet dann einen Fehler und
 * die Anfrage ist verbraucht. Geprüft wird zuletzt, dass die Sitzung wirklich diesem Konto gehört:
 * generateLink legt zu einer unbekannten Adresse ein NEUES Konto an, und ein Konto, das zwischen
 * Freigabe und Abholung gelöscht wurde, dürfte keine Sitzung bekommen.
 */
export async function issueCliSession(userId: string): Promise<CliSession | null> {
  const admin = createAdminClient();

  const { data: found, error: findError } = await admin.auth.admin.getUserById(userId);
  const email = found?.user?.email;
  if (findError || !email) return null;

  const { data: link, error: linkError } = await admin.auth.admin.generateLink({
    type: "magiclink",
    email,
  });
  const tokenHash = link?.properties?.hashed_token;
  if (linkError || !tokenHash) return null;

  const { data: verified, error: verifyError } = await anonClient().auth.verifyOtp({
    token_hash: tokenHash,
    type: "magiclink",
  });
  if (verifyError || !verified.session || verified.user?.id !== userId) return null;
  return toCliSession(verified.session);
}

/**
 * Tauscht ein Refresh-Token gegen eine neue Sitzung. `"invalid"`, wenn der Auth-Server das Token
 * ablehnt (abgelaufen, schon zu oft benutzt, Sitzung beendet): das Terminal muss neu anmelden. `null`,
 * wenn der Auth-Server nicht antwortet: später noch einmal versuchen.
 */
export async function refreshCliSession(refreshToken: string): Promise<CliSession | "invalid" | null> {
  const { data, error } = await anonClient().auth.refreshSession({ refresh_token: refreshToken });
  if (data?.session) return toCliSession(data.session);
  const status = error?.status;
  if (typeof status === "number" && status >= 400 && status < 500) return "invalid";
  return null;
}

/**
 * Beendet genau die Sitzung, zu der dieses Access-Token gehört (scope local): die Browser-Sitzung und
 * andere Geräte bleiben. `"unauthorized"`, wenn das Token nicht (mehr) gilt, `null`, wenn der Auth-Server
 * nicht antwortet. Das Token wird vorher beim Auth-Server geprüft, nicht nur gelesen.
 */
export async function revokeCliSession(accessToken: string): Promise<"ok" | "unauthorized" | null> {
  const admin = createAdminClient();
  const { data, error } = await admin.auth.getUser(accessToken);
  if (!data?.user) {
    const status = error?.status;
    return typeof status === "number" && status >= 400 && status < 500 ? "unauthorized" : null;
  }
  const { error: signOutError } = await admin.auth.admin.signOut(accessToken, "local");
  return signOutError ? null : "ok";
}
