import { localSupabase } from "./env";

// Das Postfach des lokalen Stacks (Mailpit, `[local_smtp]` in supabase/config.toml).
// Mails, die Supabase Auth lokal "verschickt", landen dort statt im Netz. Der Test
// holt die Mail ab, die ein Mensch bekäme, und geht ihren Link.
//
// Wie `localSupabase()` spricht auch dieses Modul nur mit dem eigenen Rechner: ein
// Mailpit-Aufruf gegen eine fremde Adresse ließe die Tests Mails von einem
// gehosteten Dienst lesen oder löschen.

export type Mail = { id: string; subject: string; to: string[]; html: string; text: string };

function mailpitBase(): string {
  const configured = process.env.E2E_MAILPIT_URL;
  // Standard: derselbe Rechner wie die API des Stacks, Port aus der Konfiguration.
  const raw = configured ?? `${new URL(localSupabase().url).protocol}//${new URL(localSupabase().url).hostname}:54324`;
  const url = new URL(raw);
  if (url.hostname !== "127.0.0.1" && url.hostname !== "localhost") {
    throw new Error(`E2E: Mailpit-Adresse ${url.origin} ist nicht lokal. Die Tests lesen nur das eigene Postfach.`);
  }
  return url.origin;
}

async function api<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${mailpitBase()}/api/v1${path}`, init);
  if (!res.ok) throw new Error(`E2E: Mailpit ${init?.method ?? "GET"} ${path} antwortete ${res.status}`);
  return (await res.json()) as T;
}

type SearchResult = { messages: { ID: string; Subject: string }[] };
type MessageResult = { ID: string; Subject: string; HTML: string; Text: string; To: { Address: string }[] };

/** Wartet, bis eine Mail an `to` eingetroffen ist, und liefert die neueste. */
export async function waitForMail(to: string, { timeoutMs = 30_000 }: { timeoutMs?: number } = {}): Promise<Mail> {
  const deadline = Date.now() + timeoutMs;
  let lastError: unknown;
  while (Date.now() < deadline) {
    try {
      const found = await api<SearchResult>(`/search?query=${encodeURIComponent(`to:${to}`)}`);
      if (found.messages.length > 0) {
        // Mailpit sortiert die neueste zuerst.
        const message = await api<MessageResult>(`/message/${found.messages[0].ID}`);
        return {
          id: message.ID,
          subject: message.Subject,
          to: message.To.map((a) => a.Address),
          html: message.HTML,
          text: message.Text,
        };
      }
    } catch (error) {
      // Mailpit startet etwas nach der API des Stacks: kurz weiter versuchen.
      lastError = error;
    }
    await new Promise((resolve) => setTimeout(resolve, 500));
  }
  throw new Error(
    `E2E: keine Mail an ${to} nach ${timeoutMs} ms. ` +
      (lastError ? `Letzter Fehler: ${lastError instanceof Error ? lastError.message : String(lastError)}. ` : "") +
      'Läuft Mailpit? In supabase/config.toml muss `[local_smtp] enabled = true` stehen.'
  );
}

/** Räumt die Mails an `to` weg, damit ein späterer Lauf nie eine alte Mail liest. */
export async function deleteMailsFor(to: string): Promise<void> {
  try {
    const found = await api<SearchResult>(`/search?query=${encodeURIComponent(`to:${to}`)}`);
    if (found.messages.length === 0) return;
    await fetch(`${mailpitBase()}/api/v1/messages`, {
      method: "DELETE",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ IDs: found.messages.map((m) => m.ID) }),
    });
  } catch {
    // Aufräumen darf einen Test nie rot machen, der sonst grün war.
  }
}

/** Die Adresse hinter dem ersten Link in `html`, der `fragment` enthält. HTML-Zeichen sind aufgelöst. */
export function linkContaining(html: string, fragment: string): string {
  for (const match of html.matchAll(/href="([^"]+)"/g)) {
    const href = match[1].replaceAll("&amp;", "&");
    if (href.includes(fragment)) return href;
  }
  throw new Error(`E2E: kein Link mit "${fragment}" in der Mail.`);
}
