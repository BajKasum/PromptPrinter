import { MAX_USER_MESSAGE_CHARS } from "@/shared/lib/chat-limits";

// "Als Ausgangspunkt nutzen": ein neuer Chat, dessen Eingabefeld einen gespeicherten Prompt trägt, darüber eine Zeile
// für die Änderung ("Pass diesen Prompt an: "). In der Adresse steht nur die ID (`?from=<id>`), nie der Text; die Seite
// lädt ihn auf dem Server (server/start-from-prompt.ts). Gesendet wird erst, wenn die Person es will.

const SAVED_PROMPT_ID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Nur was wie die ID eines gespeicherten Prompts aussieht, geht überhaupt an die Datenbank. */
export function isSavedPromptId(value: unknown): value is string {
  return typeof value === "string" && SAVED_PROMPT_ID.test(value);
}

/**
 * Der Starttext für das Eingabefeld: die Zeile für die Änderung, eine Leerzeile, der Prompt. null, wenn er nicht in
 * eine Nachricht passt (MAX_USER_MESSAGE_CHARS): dann bietet die Karte den Weg nicht an, und die Seite füllt nichts
 * vor, statt einen Text zu setzen, den der Server ablehnen würde.
 */
export function startFromText(prefix: string, prompt: string): string | null {
  const body = prompt.trim();
  if (!body) return null;
  const text = `${prefix.trim()} \n\n${body}`;
  return text.length <= MAX_USER_MESSAGE_CHARS ? text : null;
}

/** Wo der Cursor im Starttext steht: am Ende der ersten Zeile, damit die Person gleich schreibt, was sich ändert. */
export function startFromCaret(text: string): number {
  const end = text.indexOf("\n");
  return end === -1 ? text.length : end;
}

/** Der neue Chat im selben Projekt, sonst ein globaler. */
export function startFromHref(promptId: string, projectId?: string | null): string {
  const query = `?from=${encodeURIComponent(promptId)}`;
  return projectId ? `/projects/${encodeURIComponent(projectId)}/chats/new${query}` : `/chats/new${query}`;
}
