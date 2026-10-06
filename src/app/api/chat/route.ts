import { requestT } from "@/server/i18n";
import { authenticate, checkAttachments, readTranscript } from "./gate";
import { reserveAllowance } from "./allowance";
import { buildModelMessages, buildSystemInstruction, openChatTurn } from "./turn";
import { replyStream } from "./reply-stream";

export const runtime = "nodejs";
export const maxDuration = 300;

// POST /api/chat: ein Chat-Zug. Die Route ist nur noch die Reihenfolge der Schritte, die Schritte
// stehen daneben (Betriebs-Audit M7, Teil 3, reine Zerlegung ohne Verhaltensaenderung):
//
//   gate.ts          1 Sitzung, 2 Verlauf lesen und pruefen, 2b Anhaenge pruefen
//   allowance.ts     3 Monatskontingent, 4 Stundengrenze, 4b Tagesbudget, 4c Produktionssperre
//   turn.ts          5 Systemprompt, 6 Zug oeffnen, 6b Verlauf fuer das Modell
//   reply-stream.ts  7 Antwort erzeugen, speichern, als SSE-Strom ausliefern
//
// Ein Schritt gibt ENTWEDER eine Response (die Route antwortet damit sofort) ODER seinen Wert zurueck.
// Die Reihenfolge ist Vertrag, und jeder Ausstieg nach der ersten Reservierung gibt sie zurueck:
// route.exits.test.ts haelt beides fest.
export async function POST(req: Request) {
  // Die Sprache der Fehlermeldungen: die der App (Cookie pp-locale).
  const { t, locale } = requestT(req);
  const m = t.api;

  const session = await authenticate(m);
  if (session instanceof Response) return session;
  const { supabase, userId } = session;

  const input = await readTranscript(req, m, locale);
  if (input instanceof Response) return input;

  const uploads = await checkAttachments({ supabase, userId, input, m, locale });
  if (uploads instanceof Response) return uploads;

  const allowance = await reserveAllowance({ req, supabase, userId, m });
  if (allowance instanceof Response) return allowance;
  const { override, releaseReservations } = allowance;

  const { systemInstruction, verifiedProjectId } = await buildSystemInstruction({
    supabase,
    userId,
    input,
  });

  const opened = await openChatTurn({
    supabase,
    userId,
    input,
    verifiedProjectId,
    uploads,
    releaseReservations,
    m,
  });
  if (opened instanceof Response) return opened;

  const { inheritFrom, modelWindow, modelMessages, attachmentStats } = await buildModelMessages({
    supabase,
    userId,
    input,
    uploads,
    opened,
    override,
  });

  const stream = replyStream({
    req,
    supabase,
    userId,
    m,
    input,
    uploads,
    opened,
    override,
    releaseReservations,
    systemInstruction,
    verifiedProjectId,
    inheritFrom,
    modelWindow,
    modelMessages,
    attachmentStats,
  });

  return new Response(stream, {
    headers: {
      "content-type": "text/event-stream; charset=utf-8",
      "cache-control": "no-cache, no-transform",
      connection: "keep-alive",
      // Disabling proxy buffering (nginx et al.) so deltas actually arrive
      // incrementally instead of being held until the stream closes.
      "x-accel-buffering": "no",
    },
  });
}
