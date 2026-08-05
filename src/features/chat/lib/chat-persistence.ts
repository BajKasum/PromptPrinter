import { truncate, MAX_ASSISTANT_MESSAGE_CHARS } from "@/shared/lib/chat-limits";
import type { ChatRequest } from "@/shared/lib/schemas";
import type { createClient } from "@/server/supabase/server";

// Persistenz eines Chat-Zugs fuer /api/chat, in zwei Haelften (Planpunkt C-1).
//
// ─── Warum zwei Haelften und nicht mehr eine ──────────────────────────────
// Vorher schrieb `persistTurn` die Nutzer-Nachricht UND die Antwort zusammen,
// nachdem der Stream vollstaendig durchgelaufen war. Wer den Tab schloss,
// waehrend Finn noch schrieb, verlor damit den ganzen Zug — auch die eigene
// Frage, die schon minutenlang getippt worden war. Sie war nie in der
// Datenbank; der Prozess, der sie haette schreiben sollen, war genau der, den
// das Schliessen beendet hat.
//
// Jetzt: `openTurn()` vor dem Modellaufruf (Konversation + Frage),
// `completeTurn()` danach (Antwort). Aendert die Reihenfolge, nicht das
// Datenmodell — keine neue Spalte, keine neue Tabelle, nur ein Zustand, den
// es vorher nicht gab: eine Frage ohne Antwort.
//
// ─── Der neue Zustand, und wer ihn auffaengt ──────────────────────────────
// Eine Konversation kann nun mit einer Nutzer-Nachricht enden. Drei Stellen
// tragen das:
//   * Die Leseseite rendert den Verlauf, wie er kommt — eine letzte Frage
//     ohne Antwort ist genau das, was passiert ist, und wird auch so gezeigt.
//   * `collapseConsecutiveRoles` in route.ts fasst zwei aufeinanderfolgende
//     Nutzer-Zuege zusammen, bevor sie an einen Anbieter gehen (QA-Befund
//     F-4) — Anthropic verlangt strikt abwechselnde Rollen.
//   * Das Monatskontingent zaehlt `role = 'assistant'`, ein abgebrochener Zug
//     kostet also weiterhin nichts.
//
// ─── Warum es trotzdem ein Zuruecknehmen gibt ─────────────────────────────
// Bei einem ANBIETER-Fehler rollt die Oberflaeche die Frage zurueck und stellt
// die Eingabe wieder her (QA-Befund F-4/U-6). Bliebe die Zeile stehen, liefen
// Anzeige und Datenbank auseinander: nach einem Reload staende die Frage
// wieder da, und in der Seitenleiste haenge ein Chat, der nur aus ihr besteht.
// `rollbackTurn()` raeumt genau diesen Fall auf — nicht den Tab-Schluss, denn
// dort ist das Stehenbleiben ja der Sinn der Sache.

/** Was `openTurn` hinterlaesst, und was `rollbackTurn` braucht. */
export type OpenedTurn = {
  conversationId: string;
  /** Zeilen-ID der eben geschriebenen Frage. */
  userMessageId: string;
  /**
   * Wurde die Konversation in DIESEM Request angelegt? Nur dann darf ein
   * Zuruecknehmen sie mitloeschen — sonst raeumte ein fehlgeschlagener Zug
   * einen laengst bestehenden Chat ab.
   */
  createdConversation: boolean;
};

/**
 * Schreibt Konversation und Frage, bevor das Modell ueberhaupt gefragt wird.
 *
 * Gibt die Konversations-ID zurueck, damit die Route sie sofort an den Client
 * senden kann (SSE-Ereignis `meta`) — ein Reload mitten im Stream landet
 * dadurch im richtigen Chat statt auf `/chats/new`.
 */
export async function openTurn(
  supabase: NonNullable<Awaited<ReturnType<typeof createClient>>>,
  userId: string,
  input: ChatRequest,
  // Explicit, ownership-verified project id (QA finding F-8) — never read
  // input.projectId directly here, that's the unverified value straight off
  // the wire. Callers pass the value buildProjectContext already confirmed
  // exists and belongs to this user (or null, for a global chat / an
  // unowned-or-missing project, which this treats identically).
  verifiedProjectId: string | null
): Promise<OpenedTurn> {
  // The client appends the user message before posting, so the last entry is
  // always the new user turn. route.ts enforces this as a real validation
  // step before calling here (Security-Audit finding L-5) — this was
  // previously an unchecked assumption, storing whatever role the wire
  // carried in that position. Asserted again here, not just documented,
  // since this function's own contract depends on it regardless of what its
  // one current caller happens to guarantee.
  const newUser = input.messages[input.messages.length - 1];
  if (!newUser || newUser.role !== "user") {
    throw new Error("openTurn: last message must be role 'user'");
  }

  let conversationId = input.conversationId ?? null;
  let createdConversation = false;

  // Confirm the caller still owns the passed conversation (RLS scopes the
  // select to the owner); if it's gone or not theirs, start a fresh one.
  if (conversationId) {
    const { data: existing } = await supabase
      .from("conversations")
      .select("id")
      .eq("id", conversationId)
      .eq("user_id", userId)
      .maybeSingle();
    if (!existing) conversationId = null;
  }

  if (!conversationId) {
    const title = deriveTitle(input.messages[0]?.content ?? "");
    const { data: created, error } = await supabase
      .from("conversations")
      .insert({
        user_id: userId,
        target: input.target ?? null,
        title,
        project_id: verifiedProjectId,
      })
      .select("id")
      .single();
    if (error) throw error;
    const id = created?.id as string | undefined;
    if (!id) throw new Error("conversation insert returned no id");
    conversationId = id;
    createdConversation = true;
  } else {
    // Continued chat, bump updated_at so it sorts to the top of the list, and
    // carry over a target the user changed mid-conversation — it used to be
    // written only at creation, so switching the build tool later was accepted
    // for that one turn and then silently forgotten.
    await supabase
      .from("conversations")
      .update({ updated_at: new Date().toISOString(), target: input.target ?? null })
      .eq("id", conversationId)
      .eq("user_id", userId);
  }

  const { data: inserted, error: msgErr } = await supabase
    .from("messages")
    .insert({
      conversation_id: conversationId,
      user_id: userId,
      role: newUser.role,
      content: newUser.content,
    })
    .select("id")
    .single();
  if (msgErr) throw msgErr;

  const userMessageId = inserted?.id as string | undefined;
  if (!userMessageId) throw new Error("message insert returned no id");

  return { conversationId, userMessageId, createdConversation };
}

/**
 * Haengt die Antwort an einen bereits geoeffneten Zug.
 *
 * Wird auch beim Abbruch mit Teiltext aufgerufen: was schon da war, gehoert
 * gespeichert, sonst verliert ein "Stopp" den halben Prompt.
 */
export async function completeTurn(
  supabase: NonNullable<Awaited<ReturnType<typeof createClient>>>,
  userId: string,
  conversationId: string,
  reply: string
): Promise<void> {
  // Never store a reply the request contract couldn't accept back: it would be
  // replayed on the next turn and fail validation, which is exactly how a chat
  // used to die permanently (QA finding F-2). The provider's own max_tokens
  // keeps real replies far below this, so it only ever fires for a BYOK custom
  // endpoint that ignores it — in which case a truncated stored reply beats an
  // unusable chat. The client keeps the untruncated text it already rendered.
  const storedReply = truncate(reply, MAX_ASSISTANT_MESSAGE_CHARS);
  const { error } = await supabase.from("messages").insert({
    conversation_id: conversationId,
    user_id: userId,
    role: "assistant",
    content: storedReply,
  });
  if (error) throw error;
}

/**
 * Nimmt einen geoeffneten Zug zurueck, wenn der Anbieter-Aufruf gescheitert ist.
 *
 * Ausdruecklich NICHT beim Tab-Schluss aufrufen — dort ist das Stehenbleiben
 * der Frage genau der Zweck von C-1.
 *
 * Best effort: schlaegt das Loeschen fehl, bleibt eine Frage ohne Antwort
 * stehen. Unschoen, aber harmlos — und deutlich besser als eine Ausnahme, die
 * den ohnehin schon fehlgeschlagenen Zug ein zweites Mal abbricht.
 */
export async function rollbackTurn(
  supabase: NonNullable<Awaited<ReturnType<typeof createClient>>>,
  userId: string,
  opened: OpenedTurn
): Promise<void> {
  try {
    if (opened.createdConversation) {
      // Nimmt die Nachricht per ON DELETE CASCADE gleich mit.
      await supabase
        .from("conversations")
        .delete()
        .eq("id", opened.conversationId)
        .eq("user_id", userId);
      return;
    }
    await supabase
      .from("messages")
      .delete()
      .eq("id", opened.userMessageId)
      .eq("user_id", userId);
  } catch {
    // siehe oben: best effort
  }
}

// A short, single-line title derived from the opening message.
function deriveTitle(text: string): string {
  const clean = text.trim().replace(/\s+/g, " ");
  if (!clean) return "Neuer Chat";
  return clean.length > 60 ? `${clean.slice(0, 57)}…` : clean;
}
