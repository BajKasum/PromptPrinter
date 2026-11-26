// Wie der Browser die Antworten der eigenen API-Routen liest und welchen Text eine Person bei einem Fehlschlag sieht.
// Die Routen antworten mit problem+json und einem übersetzten `detail` (server/http/api-problem.ts). Alles andere, die
// HTML-Seite eines Zeitlimits oder Proxys und die Meldungen des Browsers selbst ("Failed to fetch", "Unexpected token
// '<' ... is not valid JSON"), ist weder übersetzt noch für Menschen geschrieben. Deshalb zeigt niemand
// `error.message`, sondern das Ergebnis von failureText.

/** Ein Fehler, dessen Meldung für Menschen geschrieben ist (von der Route oder aus dem Wörterbuch). */
export class UserError extends Error {
  constructor(
    message: string,
    /** Die Art der Ablehnung (`kind`), etwa "unknownProvider". */
    readonly kind: string | null = null,
    /** Der Code der Ablehnung (`code`), etwa "reauth_required". */
    readonly code: string | null = null
  ) {
    super(message);
  }
}

// application/json und jede Spielart davon (application/problem+json).
const JSON_TYPE = /^application\/(?:[\w.-]+\+)?json\s*(?:;|$)/i;

/** Der Rumpf einer Antwort, wenn sie JSON ist; sonst null (Fehlerseite, leerer oder abgeschnittener Rumpf). */
export async function readJson<T = Record<string, unknown>>(res: Response): Promise<T | null> {
  if (!JSON_TYPE.test(res.headers.get("content-type") ?? "")) return null;
  try {
    return (await res.json()) as T;
  } catch {
    return null;
  }
}

/** Eine abgelehnte Anfrage als Fehler: mit dem `detail` der Route, ohne eines mit dem Ersatztext. */
export async function readProblem(res: Response, fallback: string): Promise<UserError> {
  const body = await readJson<Record<string, unknown>>(res);
  const field = (name: string) => {
    const value = body?.[name];
    return typeof value === "string" && value ? value : null;
  };
  return new UserError(field("detail") ?? fallback, field("kind"), field("code"));
}

/**
 * Der Text zu einem Fehlschlag. Die Meldung eines UserError bleibt. `fetch` wirft ohne Verbindung einen TypeError, der
 * wird zum Netzwerk-Text. Alles andere, auch ein SyntaxError, bekommt den Ersatztext der Aktion.
 */
export function failureText(error: unknown, texts: { network: string; fallback: string }): string {
  if (error instanceof UserError) return error.message;
  return error instanceof TypeError ? texts.network : texts.fallback;
}
