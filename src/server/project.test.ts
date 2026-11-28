import { beforeEach, describe, expect, it, vi } from "vitest";
import { tablesClient } from "@tests/support/supabase-tables";
import { getProject } from "@/server/project";

// getProject trägt die Regel der Workspace-Seiten: ohne Sitzung zur Anmeldung, eine fremde oder falsch geformte
// Kennung ist ein 404, und die Abfrage grenzt selbst auf das Konto ein (RLS und zusätzlich user_id). Der Nachbau liefert
// jede Zeile, die die Abfrage durchlässt, wie eine Datenbank, deren Policy zu weit geht.
const OWN = "6f1c2d3e-4b5a-4c7d-8e9f-0a1b2c3d4e5f";
const FOREIGN = "0a1b2c3d-4e5f-4a6b-8c7d-9e0f1a2b3c4d";
const MISSING = "11111111-2222-4333-8444-555555555555";

const row = (id: string, userId: string, overrides: Record<string, unknown> = {}) => ({
  id,
  user_id: userId,
  name: `Projekt ${id}`,
  instructions: "Schreib knapp.",
  context: { Ziel: "Bewerbung" },
  audience: null,
  idea: null,
  type: "general",
  is_favorite: false,
  updated_at: "2026-11-01T10:00:00.000Z",
  ...overrides,
});

let client = tablesClient();
let user: { id: string } | null = { id: "user-1" };
const createClient = vi.fn(async () => client);

vi.mock("next/navigation", () => ({
  redirect: (to: string) => {
    throw new Error(`NEXT_REDIRECT ${to}`);
  },
  notFound: () => {
    throw new Error("NEXT_NOT_FOUND");
  },
}));
vi.mock("@/server/supabase/server", () => ({ createClient: () => createClient() }));
vi.mock("@/server/session", () => ({ getSessionUser: async () => user }));

beforeEach(() => {
  user = { id: "user-1" };
  createClient.mockClear();
  client = tablesClient({ tables: { projects: [row(OWN, "user-1"), row(FOREIGN, "user-2")] } });
});

describe("getProject", () => {
  it("gibt dem Eigentümer sein Projekt samt seiner Kennung", async () => {
    await expect(getProject(OWN)).resolves.toMatchObject({
      id: OWN,
      userId: "user-1",
      name: `Projekt ${OWN}`,
      instructions: "Schreib knapp.",
      context: { Ziel: "Bewerbung" },
    });
  });

  it("liest mit der Kennung des Projekts und der aus der geprüften Sitzung", async () => {
    await getProject(OWN);
    expect(client.reads).toHaveLength(1);
    expect(client.reads[0].table).toBe("projects");
    expect(client.reads[0].filters).toEqual([
      ["eq", "id", OWN],
      ["eq", "user_id", "user-1"],
    ]);
  });

  it.each([
    ["ein fremdes Projekt, auch wenn RLS die Zeile durchliesse", FOREIGN],
    ["eine unbekannte Kennung", MISSING],
  ])("ist ein 404 für %s", async (_name, id) => {
    await expect(getProject(id)).rejects.toThrow("NEXT_NOT_FOUND");
  });

  it.each([
    "",
    "neu",
    "123",
    `${OWN}x`,
    `x${OWN}`,
    OWN.replace(/-/g, ""),
    "00000000-0000-0000-0000-00000000000g",
  ])("ist ein 404 für die falsch geformte Kennung %j, ohne die Datenbank zu fragen", async (id) => {
    await expect(getProject(id)).rejects.toThrow("NEXT_NOT_FOUND");
    expect(createClient).not.toHaveBeenCalled();
    expect(client.reads).toHaveLength(0);
  });

  it("schickt ohne Sitzung zur Anmeldung, ohne die Datenbank zu fragen", async () => {
    user = null;
    await expect(getProject(OWN)).rejects.toThrow("NEXT_REDIRECT /login");
    expect(client.reads).toHaveLength(0);
  });

  it("prüft die Sitzung vor der Kennung: abgemeldet führt auch eine falsche Kennung zur Anmeldung", async () => {
    user = null;
    await expect(getProject("falsch")).rejects.toThrow("NEXT_REDIRECT /login");
  });

  it("wirft bei einem Lesefehler, statt ein vorhandenes Projekt als 404 zu zeigen", async () => {
    client = tablesClient({ errors: { projects: "connection reset" } });
    await expect(getProject(OWN)).rejects.toThrow("database read failed: projects");
  });

  it.each<[string, unknown, Record<string, string>]>([
    ["nur Texte mit Inhalt", { Ziel: "Bewerbung", leer: "   ", zahl: 3, ja: true, nichts: null, tief: { a: "b" } }, { Ziel: "Bewerbung" }],
    ["eine Liste", ["Ziel", "Ton"], {}],
    ["ein Text", "Ziel: Bewerbung", {}],
    ["nichts", null, {}],
  ])("gibt als context %s weiter", async (_name, context, expected) => {
    client = tablesClient({ tables: { projects: [row(OWN, "user-1", { context })] } });
    // toEqual auf dem Feld: toMatchObject liesse zusätzliche Einträge durchgehen.
    expect((await getProject(OWN)).context).toEqual(expected);
  });
});
