import "server-only";

/**
 * Das Token aus `Authorization: Bearer …`. `null`, wenn die Anfrage dieses Schema nicht benutzt
 * (kein Kopf oder ein anderes Schema wie Basic); ein leerer String, wenn der Kopf Bearer sagt und
 * kein Token folgt. Der Unterschied zählt: wer Bearer sagt, wird nie mit seinem Cookie bedient
 * (createClientForRequest), ein leeres oder kaputtes Token endet also im 401.
 */
export function bearerToken(req: Request): string | null {
  const header = req.headers.get("authorization");
  if (!header) return null;
  const match = /^bearer(?:\s+(.*))?$/i.exec(header.trim());
  if (!match) return null;
  return (match[1] ?? "").trim();
}
