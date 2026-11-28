import "server-only";

import { problem } from "@/server/http/api-problem";
import { MAX_SMALL_BODY_BYTES, RequestBodyTooLargeError, readJsonBody } from "@/server/http/request-body";
import { invalidJsonProblem, validationProblem } from "@/server/http/validation-problem";
import type { z } from "@/shared/lib/zod";
import type { Messages } from "@/shared/i18n/messages/de";

// Der Anfang jeder Route mit JSON-Rumpf: begrenzt lesen, dann prüfen. Beides gibt ENTWEDER den Wert ODER die fertige
// Absage zurück, die Route antwortet mit ihr sofort (wie die Schritte in api/chat/). Was vor dem Lesen kommen muss,
// Sitzung oder Ratenlimit, entscheidet jede Route selbst und ruft erst danach.

type ApiMessages = Messages["api"];

/** Die Texte der beiden Absagen beim Lesen. */
export type BodyTexts = { tooLarge: string; unreadable: string };

/**
 * Der geparste Rumpf, oder die Absage: 413 über `maxBytes`, 400 für alles, was kein lesbares JSON ist. Für Routen, die
 * ihre Eingabe selbst prüfen und anders ablehnen als validationProblem.
 */
export async function readBody(
  req: Request,
  m: BodyTexts,
  maxBytes: number = MAX_SMALL_BODY_BYTES
): Promise<{ body: unknown } | Response> {
  try {
    return { body: await readJsonBody(req, maxBytes) };
  } catch (err) {
    if (err instanceof RequestBodyTooLargeError) return problem(413, m.tooLarge);
    return invalidJsonProblem(m);
  }
}

/** readBody samt Schema: eine abgewiesene Eingabe bekommt 400 mit Feld und `issues` (validationProblem). */
export async function readValidatedBody<Schema extends z.ZodType>(
  req: Request,
  schema: Schema,
  m: ApiMessages,
  maxBytes: number = MAX_SMALL_BODY_BYTES
): Promise<{ data: z.output<Schema> } | Response> {
  const read = await readBody(req, m, maxBytes);
  if (read instanceof Response) return read;
  const parsed = schema.safeParse(read.body);
  if (!parsed.success) return validationProblem(m, parsed.error.issues);
  return { data: parsed.data };
}
