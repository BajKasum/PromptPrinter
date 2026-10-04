import "server-only";

import type { createClient } from "@/server/supabase/server";
import { captureError } from "@/shared/lib/observability";

// Der Datenexport des Kontos: alles, was zu einem Nutzer gehört, als eine
// JSON-Datei (Betriebs-Audit 04.10.2026, Punkt "kein Datenexport zum
// Selbstbedienen").
//
// Bis dahin ging "Herausgabe" der Daten nur per Mail an den Betreiber, mit bis
// zu 30 Tagen Frist (Datenschutzerklärung). Das ist zulässig, aber ein Recht,
// das man nur per Mail ausüben kann, übt kaum jemand aus, und der Betreiber
// müsste jedes Mal von Hand exportieren.
//
// ─── Was drin ist, was nicht ──────────────────────────────────────────────
// Drin: Konto, Projekte, Projektgedächtnis, Chats samt Nachrichten, gespeicherte
// Prompts, Namen und Typen hochgeladener Dateien, Anbieter-Einträge der eigenen
// API-Keys.
// NICHT drin, mit Absicht:
//   - API-Keys und Secrets. Weder im Klartext noch verschlüsselt: der Export
//     soll gefahrlos aus dem Download-Ordner in eine Mail wandern können.
//   - Die Inhalte hochgeladener Dateien (Projektdateien, Chat-Anhänge, Bilder).
//     Sie liegen im Storage, nicht in der Datenbank; ein Export, der sie
//     einbettete, würde zum 100-MB-Download. Die Datei trägt Namen, Typ und
//     Grösse, der Nutzer hat die Originale selbst.
//   - Interna des Betriebs: Admin-Kennzeichen, Kundennummern und Portal-Links
//     des Zahlungsanbieters, Zähler, Ratenlimits, Protokolle.
//
// ─── Wie es abgesichert ist ───────────────────────────────────────────────
// 1. Alles läuft mit dem Client des angemeldeten Nutzers (RLS) UND mit einem
//    ausdrücklichen `.eq("user_id", …)`. Kein Service-Role-Zugriff: der Export
//    kann nicht mehr sehen, als der Nutzer selbst sehen darf.
// 2. Jeder Abschnitt hat eine feste Positivliste von Spalten und eine ebenso
//    feste Zuordnung auf Feldnamen. Es gibt kein `select *` und kein Durchreichen
//    unbekannter Felder: kommt in einer Migration eine sensible Spalte dazu,
//    landet sie nicht still im Export.
// 3. Gestreamt, nicht im Speicher gebaut: ein Konto mit tausenden Nachrichten
//    sprengt sonst die Antwortgrösse der Funktion (Vercel nimmt nicht gestreamte
//    Antworten nur bis 4,5 MB).

type UserClient = NonNullable<Awaited<ReturnType<typeof createClient>>>;
type Row = Record<string, unknown>;

export const EXPORT_VERSION = 1;
/** PostgREST kappt eine Antwort bei 1000 Zeilen (max-rows), also seitenweise. */
export const EXPORT_PAGE_SIZE = 1000;

type Section = {
  /** Schlüssel in der JSON-Datei. */
  key: string;
  table: string;
  /** Positivliste der Spalten, genau diese und nie `*`. */
  columns: string;
  /** Feste Gesamtordnung, sonst verschieben sich Seiten zwischen zwei Abfragen. */
  orderBy: [string, string?];
  map: (row: Row) => Row;
};

export const EXPORT_SECTIONS: readonly Section[] = [
  {
    key: "projects",
    table: "projects",
    columns:
      "id, name, audience, idea, tools, status, type, instructions, context, is_favorite, created_at, updated_at",
    orderBy: ["created_at", "id"],
    map: (r) => ({
      id: r.id,
      name: r.name,
      audience: r.audience,
      idea: r.idea,
      tools: r.tools,
      status: r.status,
      type: r.type,
      instructions: r.instructions,
      context: r.context,
      isFavorite: r.is_favorite,
      createdAt: r.created_at,
      updatedAt: r.updated_at,
    }),
  },
  {
    key: "projectFiles",
    table: "project_files",
    columns: "id, project_id, name, mime, size_bytes, created_at",
    orderBy: ["created_at", "id"],
    map: (r) => ({
      id: r.id,
      projectId: r.project_id,
      name: r.name,
      mime: r.mime,
      sizeBytes: r.size_bytes,
      createdAt: r.created_at,
    }),
  },
  {
    key: "projectMemories",
    table: "project_brains",
    columns: "project_id, status, facts, repo_url, repo_ref, analyzed_at, created_at, updated_at",
    orderBy: ["project_id"],
    map: (r) => ({
      projectId: r.project_id,
      status: r.status,
      facts: r.facts,
      repoUrl: r.repo_url,
      repoRef: r.repo_ref,
      analyzedAt: r.analyzed_at,
      createdAt: r.created_at,
      updatedAt: r.updated_at,
    }),
  },
  {
    key: "conversations",
    table: "conversations",
    columns: "id, title, project_id, created_at, updated_at",
    orderBy: ["created_at", "id"],
    map: (r) => ({
      id: r.id,
      title: r.title,
      projectId: r.project_id,
      createdAt: r.created_at,
      updatedAt: r.updated_at,
    }),
  },
  {
    key: "messages",
    table: "messages",
    columns: "id, conversation_id, role, content, created_at",
    orderBy: ["created_at", "id"],
    map: (r) => ({
      id: r.id,
      conversationId: r.conversation_id,
      role: r.role,
      content: r.content,
      createdAt: r.created_at,
    }),
  },
  {
    key: "messageAttachments",
    table: "message_attachments",
    columns: "id, message_id, conversation_id, name, kind, media_type, size_bytes, created_at",
    orderBy: ["created_at", "id"],
    // Bewusst ohne storage_path: ein interner Speicherpfad hilft dem Nutzer
    // nicht und verrät nur, wie der Bucket aufgebaut ist.
    map: (r) => ({
      id: r.id,
      messageId: r.message_id,
      conversationId: r.conversation_id,
      name: r.name,
      kind: r.kind,
      mediaType: r.media_type,
      sizeBytes: r.size_bytes,
      createdAt: r.created_at,
    }),
  },
  {
    key: "savedPrompts",
    table: "generations",
    columns: "id, project_id, outputs, model, created_at",
    orderBy: ["created_at", "id"],
    map: (r) => ({
      id: r.id,
      projectId: r.project_id,
      outputs: r.outputs,
      model: r.model,
      createdAt: r.created_at,
    }),
  },
  {
    key: "apiKeys",
    table: "user_api_keys",
    // encrypted_key steht nicht in der Liste und der Nutzer-Client darf die
    // Spalte ohnehin nicht lesen (Migration 0020). Der Eintrag sagt nur, WELCHE
    // Anbieter hinterlegt sind.
    columns: "id, provider, label, base_url, model, is_active, created_at",
    orderBy: ["created_at", "id"],
    map: (r) => ({
      provider: r.provider,
      label: r.label,
      baseUrl: r.base_url,
      model: r.model,
      isActive: r.is_active,
      createdAt: r.created_at,
    }),
  },
];

type AuthUser = { id: string; email?: string | null; created_at?: string | null };

/** Die Spalten des Profils, die der Export liest. Eine Stelle für Route und Test. */
export const PROFILE_COLUMNS =
  "display_name, plan, settings, is_admin, created_at, subscription_status, subscription_renews_at, subscription_ends_at";

/**
 * Der Konto-Abschnitt. Auch hier eine Positivliste, kein Durchreichen: nicht
 * dabei sind `is_admin`, die Kundennummer, die Abo-ID und der Portal-Link des
 * Zahlungsanbieters.
 */
export function buildAccountSection(user: AuthUser, profile: Row | null): Row {
  return {
    id: user.id,
    email: user.email ?? null,
    createdAt: user.created_at ?? null,
    displayName: profile?.display_name ?? null,
    plan: profile?.plan ?? "free",
    subscription: {
      status: profile?.subscription_status ?? null,
      renewsAt: profile?.subscription_renews_at ?? null,
      endsAt: profile?.subscription_ends_at ?? null,
    },
    settings: profile?.settings ?? {},
  };
}

export function exportFilename(now: Date): string {
  return `promptprinter-export-${now.toISOString().slice(0, 10)}.json`;
}

async function* rowsOf(
  supabase: UserClient,
  userId: string,
  section: Section,
  pageSize: number
): AsyncGenerator<Row> {
  const [first, second] = section.orderBy;
  for (let from = 0; ; from += pageSize) {
    const base = supabase
      .from(section.table)
      .select(section.columns)
      .eq("user_id", userId)
      .order(first, { ascending: true });
    const ordered = second ? base.order(second, { ascending: true }) : base;
    const { data, error } = await ordered.range(from, from + pageSize - 1);
    if (error) throw new Error(`${section.table}: ${error.message}`);
    const page = (data ?? []) as unknown as Row[];
    for (const row of page) yield section.map(row);
    if (page.length < pageSize) return;
  }
}

async function* exportChunks(options: ExportOptions): AsyncGenerator<string> {
  const { supabase, userId, account, note, now = new Date(), pageSize = EXPORT_PAGE_SIZE } = options;

  yield `{"exportVersion":${EXPORT_VERSION},"exportedAt":${JSON.stringify(now.toISOString())},`;
  yield `\n"note":${JSON.stringify(note)},\n"account":${JSON.stringify(account)}`;

  for (const section of EXPORT_SECTIONS) {
    yield `,\n${JSON.stringify(section.key)}:[`;
    let first = true;
    for await (const row of rowsOf(supabase, userId, section, pageSize)) {
      yield `${first ? "\n" : ",\n"}${JSON.stringify(row)}`;
      first = false;
    }
    yield first ? "]" : "\n]";
  }

  yield "\n}\n";
}

export type ExportOptions = {
  /** Der Client des angemeldeten Nutzers (RLS), nie der Service-Role-Client. */
  supabase: UserClient;
  userId: string;
  account: Row;
  /** Der erklärende Satz in der Datei, in der Sprache der App. */
  note: string;
  now?: Date;
  pageSize?: number;
};

/**
 * Die Datei als Byte-Strom. Bricht eine Abfrage mitten drin ab, endet der Strom
 * mit einem Fehler statt sauber: der Browser meldet den Download als
 * fehlgeschlagen, statt eine abgeschnittene, still ungültige Datei als
 * vollständig abzulegen.
 */
export function accountExportStream(options: ExportOptions): ReadableStream<Uint8Array> {
  const iterator = exportChunks(options);
  const encoder = new TextEncoder();
  return new ReadableStream<Uint8Array>({
    async pull(controller) {
      try {
        const { value, done } = await iterator.next();
        if (done) controller.close();
        else controller.enqueue(encoder.encode(value));
      } catch (error) {
        captureError("account.export_failed", error, { userId: options.userId });
        controller.error(error);
      }
    },
    async cancel() {
      await iterator.return(undefined);
    },
  });
}
