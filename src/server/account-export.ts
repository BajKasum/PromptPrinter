import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/shared/supabase/database.types";
import type { createClient } from "@/server/supabase/server";
import type { CliSessionRow } from "@/server/cli-login/sessions";
import { captureError } from "@/shared/lib/observability";
import { zaiConsentOf } from "@/server/consent";

// Der Datenexport des Kontos: alles, was zu einem Nutzer gehört, als eine
// JSON-Datei zum Selbstbedienen. Ein Recht, das man nur per Mail ausüben kann,
// übt kaum jemand aus, und der Betreiber müsste jedes Mal von Hand exportieren.
//
// ─── Was drin ist, was nicht ──────────────────────────────────────────────
// Drin: Konto, Projekte, Projektgedächtnis, Chats samt Nachrichten, gespeicherte
// Prompts samt Verlauf und Freigaben per Link, Namen und Typen hochgeladener
// Dateien, Anbieter-Einträge der eigenen API-Keys, angemeldete Terminals.
// NICHT drin, mit Absicht:
//   - API-Keys und Secrets. Weder im Klartext noch verschlüsselt: der Export
//     soll gefahrlos aus dem Download-Ordner in eine Mail wandern können. Aus
//     demselben Grund fehlen der Link-Code einer Freigabe (wer ihn hat, liest
//     den Prompt) und die Kennung einer Terminal-Sitzung.
//   - Die Inhalte hochgeladener Dateien (Projektdateien, Chat-Anhänge, Bilder).
//     Sie liegen im Storage, nicht in der Datenbank; ein Export, der sie
//     einbettete, würde zum 100-MB-Download. Die Datei trägt Namen, Typ und
//     Grösse, der Nutzer hat die Originale selbst.
//   - Interna des Betriebs: Admin-Kennzeichen, Kundennummern und Portal-Links
//     des Zahlungsanbieters, Zähler, Ratenlimits, Protokolle. Welche Tabelle mit
//     user_id aus welchem Grund fehlt, steht in EXPORT_EXCLUDED_TABLES, und
//     tests/guards/account-export-coverage.test.ts gleicht das mit den Tabellen
//     in database.types.ts ab: eine neue Tabelle fällt auf, statt still zu fehlen.
//
// ─── Wie es abgesichert ist ───────────────────────────────────────────────
// 1. Alles läuft mit dem Client des angemeldeten Nutzers (RLS) UND mit einem
//    ausdrücklichen `.eq("user_id", …)`. Kein Service-Role-Zugriff: der Export
//    kann nicht mehr sehen, als der Nutzer selbst sehen darf. Die eine Ausnahme
//    sind die Terminals: cli_sessions liest nur der Server (Migration 0054), die
//    Route holt sie deshalb über dieselbe Funktion wie die Einstellungen
//    (server/cli-login/sessions.ts) und reicht sie herein, mit der Kennung aus
//    der geprüften Sitzung.
// 2. Jeder Abschnitt hat eine feste Positivliste von Spalten und eine ebenso
//    feste Zuordnung auf Feldnamen. Es gibt kein `select *` und kein Durchreichen
//    unbekannter Felder: kommt in einer Migration eine sensible Spalte dazu,
//    landet sie nicht still im Export.
// 3. Gestreamt, nicht im Speicher gebaut: ein Konto mit tausenden Nachrichten
//    sprengt sonst die Antwortgrösse der Funktion (Vercel nimmt nicht gestreamte
//    Antworten nur bis 4,5 MB).

type UserClient = NonNullable<Awaited<ReturnType<typeof createClient>>>;
type Row = Record<string, unknown>;
type TableName = keyof Database["public"]["Tables"];

export const EXPORT_VERSION = 1;
/** PostgREST kappt eine Antwort bei 1000 Zeilen (max-rows), also seitenweise. */
export const EXPORT_PAGE_SIZE = 1000;

type Section = {
  /** Schlüssel in der JSON-Datei. */
  key: string;
  table: TableName;
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
      "id, name, audience, idea, tools, type, instructions, context, is_favorite, created_at, updated_at",
    orderBy: ["created_at", "id"],
    map: (r) => ({
      id: r.id,
      name: r.name,
      audience: r.audience,
      idea: r.idea,
      tools: r.tools,
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
    columns: "id, title, project_id, source_prompt_id, created_at, updated_at",
    orderBy: ["created_at", "id"],
    map: (r) => ({
      id: r.id,
      title: r.title,
      projectId: r.project_id,
      sourcePromptId: r.source_prompt_id,
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
    table: "saved_prompts",
    columns: "id, project_id, conversation_id, outputs, created_at",
    orderBy: ["created_at", "id"],
    map: (r) => ({
      id: r.id,
      projectId: r.project_id,
      conversationId: r.conversation_id,
      outputs: r.outputs,
      createdAt: r.created_at,
    }),
  },
  {
    // Der Verlauf jedes gespeicherten Prompts (Migration 0061), je Version der ganze Text.
    key: "savedPromptVersions",
    table: "saved_prompt_versions",
    columns: "prompt_id, version, content, created_at",
    orderBy: ["prompt_id", "version"],
    map: (r) => ({
      promptId: r.prompt_id,
      version: r.version,
      content: r.content,
      createdAt: r.created_at,
    }),
  },
  {
    // Welche gespeicherten Prompts unter /geteilt/<token> öffentlich stehen, und seit wann. Ohne das Token: es ist der
    // Schlüssel zum Link, eine weitergeleitete Datei gäbe sonst den Prompt frei. Den Link zeigt die App am Prompt.
    key: "promptShares",
    table: "prompt_shares",
    columns: "prompt_id, created_at",
    orderBy: ["created_at", "prompt_id"],
    map: (r) => ({
      promptId: r.prompt_id,
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

/**
 * Die angemeldeten Terminals (Tabelle cli_sessions). Die Route liest sie über listCliSessions, dieselbe Liste, die die
 * Einstellungen zeigen; hier wird nur abgebildet, ohne die Kennung der Sitzung. Abgemeldete und abgelaufene Terminals
 * stehen nicht darin: mit der Sitzung verschwindet ihr Eintrag.
 */
export const TERMINAL_SESSIONS_SECTION = {
  key: "terminalSessions",
  table: "cli_sessions",
  map: (row: CliSessionRow): Row => ({
    clientName: row.clientName,
    createdAt: row.createdAt,
    lastUsedAt: row.lastUsedAt,
    expiresAt: row.expiresAt,
  }),
} as const satisfies { key: string; table: TableName; map: (row: CliSessionRow) => Row };

/**
 * Die Tabellen mit user_id, die der Export mit Absicht auslässt, je mit Grund. Jede andere ist ein Abschnitt des
 * Exports; tests/guards/account-export-coverage.test.ts hält beides gegen database.types.ts vollständig.
 */
export const EXPORT_EXCLUDED_TABLES: Readonly<Partial<Record<TableName, string>>> = {
  billing_events: "Was der frühere Zahlungsanbieter per Webhook gemeldet hat: ein Protokoll des Betriebs.",
  cli_device_requests:
    "Anmeldeanfragen von Terminals: sie leben höchstens einen Tag über ihren Ablauf hinaus und tragen den Hash des Gerätecodes.",
  mfa_recovery_codes: "Die Wiederherstellungscodes des zweiten Faktors: ein Geheimnis, auch als Hash.",
  security_events:
    "Das Sicherheitsprotokoll (Datenschutz, Ziffer 2): ein Protokoll des Betriebs, nur mit der Kennung des Kontos.",
};

type AuthUser = { id: string; email?: string | null; created_at?: string | null; app_metadata?: unknown };

/** Die Spalten des Profils, die der Export liest. Eine Stelle für Route und Test. */
export const PROFILE_COLUMNS =
  "display_name, about_me, plan, settings, is_admin, created_at, subscription_status, subscription_renews_at, subscription_ends_at";

/**
 * Der Konto-Abschnitt. Auch hier eine Positivliste, kein Durchreichen: nicht
 * dabei sind `is_admin`, die Kundennummer, die Abo-ID und der Portal-Link des
 * Zahlungsanbieters. `plan` und `subscription` zeigen, was in `profiles` steht:
 * die Spalten bleiben in der Datenbank, auch wenn der Code den Plan nicht mehr
 * liest (shared/lib/plans.ts), und ein Export zeigt das Gespeicherte.
 */
export function buildAccountSection(user: AuthUser, profile: Row | null): Row {
  return {
    id: user.id,
    email: user.email ?? null,
    createdAt: user.created_at ?? null,
    displayName: profile?.display_name ?? null,
    // Was Finn über die Person wissen soll (Einstellungen, "Über mich"), leer ohne Angaben.
    aboutMe: profile?.about_me ?? "",
    plan: profile?.plan ?? "free",
    subscription: {
      status: profile?.subscription_status ?? null,
      renewsAt: profile?.subscription_renews_at ?? null,
      endsAt: profile?.subscription_ends_at ?? null,
    },
    settings: profile?.settings ?? {},
    // Die Zustimmung zur Übermittlung an Z.ai (Zeitpunkt und Fassung des Hinweises), damit der Export
    // auch den Nachweis zeigt, den wir über dich führen. Sonst nichts aus app_metadata: dort kann
    // die Auth-Schicht Betriebsangaben ablegen.
    consents: { zaiTransfer: zaiConsentOf(user.app_metadata) },
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
  // Tabelle, Spalten und Sortierung stehen hier als Daten (SECTIONS), der Typprüfer kann eine Abfrage über eine
  // Vereinigung von Tabellen nicht auflösen. Geprüft ist der Tabellenname über Section.table.
  const untyped = supabase as unknown as SupabaseClient;
  for (let from = 0; ; from += pageSize) {
    const base = untyped
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

/** Ein Abschnitt als JSON-Array, eine Zeile je Eintrag. */
async function* arrayChunks(key: string, rows: AsyncIterable<Row> | Iterable<Row>): AsyncGenerator<string> {
  yield `,\n${JSON.stringify(key)}:[`;
  let first = true;
  for await (const row of rows) {
    yield `${first ? "\n" : ",\n"}${JSON.stringify(row)}`;
    first = false;
  }
  yield first ? "]" : "\n]";
}

async function* exportChunks(options: ExportOptions): AsyncGenerator<string> {
  const { supabase, userId, account, note, terminalSessions, now = new Date(), pageSize = EXPORT_PAGE_SIZE } = options;

  yield `{"exportVersion":${EXPORT_VERSION},"exportedAt":${JSON.stringify(now.toISOString())},`;
  yield `\n"note":${JSON.stringify(note)},\n"account":${JSON.stringify(account)}`;

  for (const section of EXPORT_SECTIONS) {
    yield* arrayChunks(section.key, rowsOf(supabase, userId, section, pageSize));
  }
  yield* arrayChunks(TERMINAL_SESSIONS_SECTION.key, terminalSessions.map(TERMINAL_SESSIONS_SECTION.map));

  yield "\n}\n";
}

export type ExportOptions = {
  /** Der Client des angemeldeten Nutzers (RLS), nie der Service-Role-Client. */
  supabase: UserClient;
  userId: string;
  account: Row;
  /** Die Terminals dieses Kontos, wie listCliSessions sie liefert (die Tabelle liest nur der Server). */
  terminalSessions: readonly CliSessionRow[];
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
