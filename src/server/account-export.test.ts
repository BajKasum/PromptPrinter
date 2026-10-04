import { beforeEach, describe, expect, it, vi } from "vitest";

const captureError = vi.fn();
vi.mock("@/shared/lib/observability", () => ({
  captureError: (...args: unknown[]) => captureError(...args),
}));

const {
  EXPORT_SECTIONS,
  EXPORT_VERSION,
  accountExportStream,
  buildAccountSection,
  exportFilename,
} = await import("@/server/account-export");

type Row = Record<string, unknown>;

/**
 * Ein PostgREST-förmiger Stand-in. Er hält fest, WAS gefragt wurde (Spalten,
 * Filter, Ordnung), damit Tests prüfen können, dass der Export eingegrenzt und
 * ohne `select *` fragt, und er lässt eine Tabelle gezielt scheitern.
 */
function fakeClient(tables: Record<string, Row[]>, options: { failOn?: string } = {}) {
  const queries: { table: string; columns: string; filters: [string, unknown][]; orders: string[] }[] = [];
  const client = {
    from(table: string) {
      const query = { table, columns: "", filters: [] as [string, unknown][], orders: [] as string[] };
      queries.push(query);
      const builder = {
        select(columns: string) {
          query.columns = columns;
          return builder;
        },
        eq(column: string, value: unknown) {
          query.filters.push([column, value]);
          return builder;
        },
        order(column: string) {
          query.orders.push(column);
          return builder;
        },
        range(from: number, to: number) {
          if (options.failOn === table) {
            return Promise.resolve({ data: null, error: { message: "connection reset" } });
          }
          const rows = (tables[table] ?? []).filter((r) =>
            query.filters.every(([column, value]) => r[column] === value)
          );
          return Promise.resolve({ data: rows.slice(from, to + 1), error: null });
        },
      };
      return builder;
    },
  };
  return { client: client as never, queries };
}

async function readAll(stream: ReadableStream<Uint8Array>): Promise<string> {
  return new Response(stream).text();
}

const USER = "user-1";
const OTHER = "user-2";
const account = { id: USER, email: "du@example.com" };

function options(client: never, extra: Record<string, unknown> = {}) {
  return {
    supabase: client,
    userId: USER,
    account,
    note: "Hinweis",
    now: new Date("2026-10-04T12:00:00Z"),
    ...extra,
  };
}

beforeEach(() => {
  captureError.mockReset();
});

describe("accountExportStream", () => {
  it("liefert gültiges JSON mit jedem Abschnitt, auch bei einem leeren Konto", async () => {
    const { client } = fakeClient({});
    const json = JSON.parse(await readAll(accountExportStream(options(client))));

    expect(json.exportVersion).toBe(EXPORT_VERSION);
    expect(json.exportedAt).toBe("2026-10-04T12:00:00.000Z");
    expect(json.note).toBe("Hinweis");
    expect(json.account).toEqual(account);
    for (const section of EXPORT_SECTIONS) expect(json[section.key]).toEqual([]);
  });

  it("nimmt die Zeilen des Nutzers auf und ordnet sie den Abschnitten zu", async () => {
    const { client } = fakeClient({
      projects: [
        { id: "p1", user_id: USER, name: "Mein Projekt", is_favorite: true, created_at: "2026-01-01" },
      ],
      conversations: [{ id: "c1", user_id: USER, title: "Idee", project_id: "p1" }],
      messages: [
        { id: "m1", user_id: USER, conversation_id: "c1", role: "user", content: "Hallo", created_at: "t1" },
        { id: "m2", user_id: USER, conversation_id: "c1", role: "assistant", content: "Hi", created_at: "t2" },
      ],
      generations: [{ id: "g1", user_id: USER, project_id: "p1", outputs: { prompt: "x", title: "T" } }],
    });
    const json = JSON.parse(await readAll(accountExportStream(options(client))));

    expect(json.projects).toEqual([expect.objectContaining({ id: "p1", name: "Mein Projekt", isFavorite: true })]);
    expect(json.conversations).toEqual([expect.objectContaining({ id: "c1", projectId: "p1" })]);
    expect(json.messages.map((m: Row) => m.content)).toEqual(["Hallo", "Hi"]);
    expect(json.messages[0]).toMatchObject({ conversationId: "c1", role: "user" });
    expect(json.savedPrompts[0].outputs).toEqual({ prompt: "x", title: "T" });
  });

  it("enthält NIE Zeilen eines anderen Nutzers", async () => {
    const { client } = fakeClient({
      messages: [
        { id: "mine", user_id: USER, conversation_id: "c1", role: "user", content: "meins" },
        { id: "theirs", user_id: OTHER, conversation_id: "c9", role: "user", content: "GEHEIM-DES-ANDEREN" },
      ],
    });
    const text = await readAll(accountExportStream(options(client)));
    expect(text).toContain("meins");
    expect(text).not.toContain("GEHEIM-DES-ANDEREN");
  });

  it("fragt jede Tabelle mit ausdrücklichem user_id-Filter (zusätzlich zu RLS)", async () => {
    const { client, queries } = fakeClient({});
    await readAll(accountExportStream(options(client)));

    expect(queries.map((q) => q.table).sort()).toEqual(EXPORT_SECTIONS.map((s) => s.table).sort());
    for (const query of queries) {
      expect(query.filters, query.table).toContainEqual(["user_id", USER]);
    }
  });

  it("fragt nur die Positivliste der Spalten, nie `*`, und nie encrypted_key", async () => {
    const { client, queries } = fakeClient({});
    await readAll(accountExportStream(options(client)));

    for (const query of queries) {
      expect(query.columns, query.table).not.toContain("*");
      expect(query.columns, query.table).not.toMatch(/encrypted_key|storage_path/);
    }
  });

  it("reicht unbekannte Felder nicht durch: eine später dazugekommene Spalte landet nicht im Export", async () => {
    const { client } = fakeClient({
      user_api_keys: [
        {
          id: "k1",
          user_id: USER,
          provider: "anthropic",
          encrypted_key: "GEHEIMER-CHIFFRETEXT",
          secret_note: "GEHEIM",
          is_active: true,
        },
      ],
      message_attachments: [
        { id: "a1", user_id: USER, message_id: "m1", name: "bild.png", storage_path: "u/c/geheim-pfad.png" },
      ],
      projects: [{ id: "p1", user_id: USER, name: "P", internal_flag: "INTERN" }],
    });
    const text = await readAll(accountExportStream(options(client)));

    expect(text).toContain("anthropic");
    expect(text).toContain("bild.png");
    for (const secret of ["GEHEIMER-CHIFFRETEXT", "GEHEIM", "geheim-pfad", "INTERN"]) {
      expect(text, secret).not.toContain(secret);
    }
  });

  it("blättert über mehr Zeilen als eine Seite fasst und verliert keine", async () => {
    const messages = Array.from({ length: 7 }, (_, i) => ({
      id: `m${i}`,
      user_id: USER,
      conversation_id: "c1",
      role: "user",
      content: `nachricht-${i}`,
    }));
    const { client, queries } = fakeClient({ messages });
    const json = JSON.parse(await readAll(accountExportStream(options(client, { pageSize: 3 }))));

    expect(json.messages.map((m: Row) => m.content)).toEqual(messages.map((m) => m.content));
    // 7 Zeilen bei Seitengrösse 3: drei Seiten, die letzte unvollständig.
    expect(queries.filter((q) => q.table === "messages")).toHaveLength(3);
  });

  it("fragt nach einer genau gefüllten letzten Seite noch einmal, statt abzuschneiden", async () => {
    const messages = Array.from({ length: 6 }, (_, i) => ({
      id: `m${i}`,
      user_id: USER,
      conversation_id: "c1",
      role: "user",
      content: `n-${i}`,
    }));
    const { client } = fakeClient({ messages });
    const json = JSON.parse(await readAll(accountExportStream(options(client, { pageSize: 3 }))));
    expect(json.messages).toHaveLength(6);
  });

  it("bricht den Strom mit einem Fehler ab, wenn eine Abfrage scheitert, statt eine abgeschnittene Datei als vollständig zu liefern", async () => {
    const { client } = fakeClient({}, { failOn: "messages" });
    await expect(readAll(accountExportStream(options(client)))).rejects.toThrow(/messages/);
    expect(captureError).toHaveBeenCalledWith(
      "account.export_failed",
      expect.any(Error),
      expect.objectContaining({ userId: USER })
    );
  });

  it("verträgt Zeichen, die JSON maskieren muss", async () => {
    const tricky = 'Zeile 1\nZeile 2 "zitat" \\ und ein Emoji 🐬 und </script>';
    const { client } = fakeClient({
      messages: [{ id: "m1", user_id: USER, conversation_id: "c1", role: "user", content: tricky }],
    });
    const json = JSON.parse(await readAll(accountExportStream(options(client))));
    expect(json.messages[0].content).toBe(tricky);
  });
});

describe("buildAccountSection", () => {
  it("trägt die Konto-Angaben, aber nichts vom Zahlungsanbieter oder vom Betrieb", () => {
    const section = buildAccountSection(
      { id: USER, email: "du@example.com", created_at: "2026-05-01T00:00:00Z" },
      {
        display_name: "Du",
        plan: "pro",
        settings: { locale: "fr" },
        is_admin: true,
        subscription_status: "active",
        subscription_renews_at: "2026-11-01",
        subscription_ends_at: null,
        subscription_customer_id: "cus_GEHEIM",
        subscription_portal_url: "https://portal.example/GEHEIM",
      }
    );
    const text = JSON.stringify(section);

    expect(section).toMatchObject({
      id: USER,
      email: "du@example.com",
      displayName: "Du",
      plan: "pro",
      settings: { locale: "fr" },
      subscription: { status: "active", renewsAt: "2026-11-01", endsAt: null },
    });
    expect(text).not.toContain("GEHEIM");
    expect(text).not.toContain("is_admin");
    expect(text).not.toContain("isAdmin");
  });

  it("fällt ohne Profilzeile auf Free und leere Einstellungen zurück, statt zu werfen", () => {
    expect(buildAccountSection({ id: USER }, null)).toMatchObject({
      email: null,
      plan: "free",
      settings: {},
    });
  });
});

describe("exportFilename", () => {
  it("trägt das Datum und keine Kennung des Nutzers", () => {
    expect(exportFilename(new Date("2026-10-04T23:59:59Z"))).toBe("promptprinter-export-2026-10-04.json");
  });
});
