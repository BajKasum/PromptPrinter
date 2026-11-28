import type { ReactNode } from "react";
import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { tablesClient, type Row, type TablesClientOptions } from "@tests/support/supabase-tables";
import { digestOfSources } from "@/features/projects/lib/brain-sources";
import { LIST_LOAD_LIMIT } from "@/shared/lib/chat-limits";
import { EMPTY_BRAIN_FACTS } from "@/shared/lib/project-brain";
import { fmt, plural } from "@/shared/i18n/format";
import { de } from "@/shared/i18n/messages/de";
import ProjectWorkspaceLayout from "./layout";
import ProjectOverviewPage from "./page";
import ProjectResultsPage from "./results/page";

// Der Workspace eines Projekts: Kopf und Leiste (layout), die Chats (Übersicht) und die gespeicherten Prompts
// (Ergebnisse). Alle drei beginnen mit getProject(), das echte Modul läuft hier mit: ein fremdes Projekt ist ein 404,
// bevor etwas zu ihm gelesen wird. Der Nachbau lässt jede Zeile durch, die eine Abfrage selbst durchlässt; jede
// Abfrage grenzt deshalb auf Projekt und Konto ein.
const PROJECT = "6f1c2d3e-4b5a-4c7d-8e9f-0a1b2c3d4e5f";
const FOREIGN = "0a1b2c3d-4e5f-4a6b-8c7d-9e0f1a2b3c4d";

let client = tablesClient();
const rail = vi.fn();
const chatList = vi.fn();
const savedList = vi.fn();

vi.mock("next/navigation", () => ({
  redirect: (to: string) => {
    throw new Error(`NEXT_REDIRECT ${to}`);
  },
  notFound: () => {
    throw new Error("NEXT_NOT_FOUND");
  },
}));
vi.mock("next/link", () => ({
  default: ({ href, children }: { href: string; children: ReactNode }) => <a href={href}>{children}</a>,
}));
vi.mock("@/server/supabase/server", () => ({ createClient: async () => client }));
vi.mock("@/server/session", () => ({ getSessionUser: async () => ({ id: "user-1" }) }));
vi.mock("@/server/i18n", async () => {
  const { de } = await import("@/shared/i18n/messages/de");
  return { getT: async () => de, getLocale: async () => "de" };
});
vi.mock("@/shared/motion/fade-in", () => ({ FadeIn: ({ children }: { children: ReactNode }) => <div>{children}</div> }));
vi.mock("@/features/projects/components/project-rail", () => ({
  ProjectRail: (props: Record<string, unknown>) => {
    rail(props);
    return <aside aria-label="Kontext" />;
  },
}));
vi.mock("@/features/projects/components/delete-project", () => ({
  DeleteProjectButton: ({ projectId, projectName }: { projectId: string; projectName: string }) => (
    <button type="button" data-project={projectId}>
      {projectName} löschen
    </button>
  ),
}));
vi.mock("@/features/chat/components/chat-list", () => ({
  ChatList: (props: Record<string, unknown>) => {
    chatList(props);
    return <ul aria-label="Chats" />;
  },
}));
vi.mock("@/features/prompts/components/saved-prompt-list", () => ({
  SavedPromptList: (props: Record<string, unknown>) => {
    savedList(props);
    return <ul aria-label="Gespeicherte Prompts" />;
  },
}));

const project = (id: string, userId: string, name: string): Row => ({
  id,
  user_id: userId,
  name,
  instructions: "Schreib knapp.",
  context: { Ziel: "Bewerbung" },
  audience: null,
  idea: null,
  type: "software",
  is_favorite: false,
  updated_at: new Date().toISOString(),
});

const PROJECTS = [project(PROJECT, "user-1", "Mein Projekt"), project(FOREIGN, "user-2", "Fremdes Projekt")];

/** Eine höhere Nummer ist neuer. */
const at = (number: number) => new Date(Date.UTC(2026, 0, 1, 0, number)).toISOString();

function conversation(number: number, overrides: Row = {}): Row {
  return {
    id: `c-${number}`,
    user_id: "user-1",
    project_id: PROJECT,
    title: `Chat ${number}`,
    updated_at: at(number),
    messages: [{ count: 2 }],
    ...overrides,
  };
}

function saved(number: number, overrides: Row = {}): Row {
  return {
    id: `s-${number}`,
    user_id: "user-1",
    project_id: PROJECT,
    created_at: at(number),
    outputs: { prompt: `Prompt ${number}`, title: `Titel ${number}` },
    ...overrides,
  };
}

function file(number: number, overrides: Row = {}): Row {
  return {
    id: `f-${number}`,
    user_id: "user-1",
    project_id: PROJECT,
    name: `datei-${number}.md`,
    storage_path: `user-1/${PROJECT}/datei-${number}.md`,
    size_bytes: 100 * number,
    created_at: at(number),
    ...overrides,
  };
}

const withTables = (options: TablesClientOptions = {}) => {
  client = tablesClient({ ...options, tables: { projects: PROJECTS, ...options.tables } });
};

/** Jede Abfrage ausser der des Projekts selbst grenzt auf Projekt und Konto ein. */
function expectScoped(...tables: string[]) {
  const reads = client.reads.filter((read) => read.table !== "projects");
  expect(reads.map((read) => read.table).sort()).toEqual([...tables].sort());
  for (const read of reads) {
    expect(read.filters, read.table).toEqual(
      expect.arrayContaining([
        ["eq", "project_id", PROJECT],
        ["eq", "user_id", "user-1"],
      ])
    );
  }
}

const params = (id = PROJECT) => Promise.resolve({ id });

beforeEach(() => {
  rail.mockClear();
  chatList.mockClear();
  savedList.mockClear();
  withTables();
});

describe.each([
  ["Workspace-Layout", () => ProjectWorkspaceLayout({ params: params(FOREIGN), children: null })],
  ["Übersicht", () => ProjectOverviewPage({ params: params(FOREIGN) })],
  ["Ergebnisse", () => ProjectResultsPage({ params: params(FOREIGN) })],
])("%s eines fremden Projekts", (_name, page) => {
  it("ist ein 404, bevor etwas zum Projekt gelesen wird", async () => {
    await expect(page()).rejects.toThrow("NEXT_NOT_FOUND");
    expect(client.reads.map((read) => read.table)).toEqual(["projects"]);
  });
});

describe("Workspace-Layout", () => {
  const open = async () => render(await ProjectWorkspaceLayout({ params: params(), children: <p>Inhalt</p> }));
  const railProps = () => rail.mock.lastCall?.[0] as Record<string, unknown>;

  it("zeigt Name, Zähler und den Inhalt der Unterseite, ohne fremde Zeilen mitzuzählen", async () => {
    withTables({
      tables: {
        conversations: [conversation(1), conversation(2), conversation(3, { user_id: "user-2" }), conversation(4, { project_id: "p-andere" })],
        saved_prompts: [saved(1), saved(2, { user_id: "user-2" })],
        project_files: [file(2), file(1), file(3, { user_id: "user-2" }), file(4, { project_id: "p-andere" })],
        project_brains: [],
      },
    });

    await open();

    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent("Mein Projekt");
    expect(screen.getByText(plural(de.pages.workspace.chats, 2, "de"))).toBeInTheDocument();
    expect(screen.getByText(plural(de.pages.workspace.files, 2, "de"))).toBeInTheDocument();
    expect(screen.getByText(plural(de.pages.workspace.results, 1, "de"))).toBeInTheDocument();
    expect(screen.getByText("Inhalt")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Mein Projekt löschen" })).toHaveAttribute("data-project", PROJECT);
    expectScoped("conversations", "saved_prompts", "project_files", "project_brains");
  });

  it("sagt ohne gespeicherte Prompts, dass es keine gibt", async () => {
    await open();
    expect(screen.getByText(de.pages.workspace.noResults)).toBeInTheDocument();
  });

  it("gibt der Leiste Anweisungen, Struktur und Dateien in Anlegereihenfolge", async () => {
    withTables({ tables: { project_files: [file(2), file(1)] } });

    await open();

    expect(railProps()).toMatchObject({
      projectId: PROJECT,
      userId: "user-1",
      projectType: "software",
      initialInstructions: "Schreib knapp.",
      initialContext: { Ziel: "Bewerbung" },
      files: [
        { id: "f-1", name: "datei-1.md", storagePath: `user-1/${PROJECT}/datei-1.md`, sizeBytes: 100, createdAt: at(1) },
        { id: "f-2", name: "datei-2.md", storagePath: `user-1/${PROJECT}/datei-2.md`, sizeBytes: 200, createdAt: at(2) },
      ],
    });
  });

  it("gibt ohne Gedächtnis ein leeres weiter, mit dem Fingerabdruck der Dateien", async () => {
    withTables({ tables: { project_files: [file(1)] } });

    await open();

    expect(railProps().brain).toMatchObject({
      status: "idle",
      facts: EMPTY_BRAIN_FACTS,
      repoUrl: null,
      sources: [],
      sourceDigest: null,
      analyzedAt: null,
    });
    expect(railProps().brainDigest).toBe(digestOfSources([{ id: "f-1", sizeBytes: 100 }], null));
  });

  const brainRow = (overrides: Row = {}): Row => ({
    user_id: "user-1",
    project_id: PROJECT,
    status: "ready",
    facts: { ...EMPTY_BRAIN_FACTS, summary: "Eine App für Rezepte." },
    repo_url: "https://github.com/beispiel/rezepte",
    sources: [{ label: "datei-1.md" }],
    source_digest: "abc",
    model: "glm",
    error_code: null,
    analyzed_at: at(5),
    updated_at: at(6),
    ...overrides,
  });

  it("gibt den gespeicherten Stand des Gedächtnisses weiter und rechnet die Repo-Adresse in den Fingerabdruck", async () => {
    withTables({ tables: { project_files: [file(1)], project_brains: [brainRow()] } });

    await open();

    expect(railProps().brain).toEqual({
      status: "ready",
      facts: { ...EMPTY_BRAIN_FACTS, summary: "Eine App für Rezepte." },
      repoUrl: "https://github.com/beispiel/rezepte",
      sources: [{ label: "datei-1.md" }],
      sourceDigest: "abc",
      model: "glm",
      errorCode: null,
      analyzedAt: at(5),
      updatedAt: at(6),
    });
    expect(railProps().brainDigest).toBe(
      digestOfSources([{ id: "f-1", sizeBytes: 100 }], "https://github.com/beispiel/rezepte")
    );
    expect(railProps().brainDigest).not.toBe(digestOfSources([{ id: "f-1", sizeBytes: 100 }], null));
  });

  it("zeigt eine kaputte Zeile als leeres Gedächtnis, statt sie durchzureichen", async () => {
    withTables({
      tables: { project_brains: [brainRow({ status: "erfunden", facts: "kein Objekt", sources: { label: "x" } })] },
    });

    await open();

    expect(railProps().brain).toMatchObject({ status: "idle", facts: EMPTY_BRAIN_FACTS, sources: [] });
  });

  it("ignoriert das Gedächtnis eines anderen Kontos", async () => {
    withTables({ tables: { project_brains: [brainRow({ user_id: "user-2" })] } });

    await open();

    expect(railProps().brain).toMatchObject({ status: "idle", repoUrl: null });
  });

  it.each(["conversations", "saved_prompts", "project_files", "project_brains"])(
    "wirft bei einem Lesefehler (%s), statt Nullen zu zeigen",
    async (table) => {
      withTables({ errors: { [table]: "timeout" } });
      await expect(open()).rejects.toThrow(`database read failed: ${table}`);
    }
  );
});

describe("Übersicht", () => {
  const open = async () => render(await ProjectOverviewPage({ params: params() }));
  const truncated = fmt(de.pages.workspace.truncated, { count: LIST_LOAD_LIMIT });

  it("bleibt ohne Chats stehen und bietet den ersten an, ohne umzuleiten", async () => {
    withTables({ tables: { conversations: [conversation(1, { user_id: "user-2" })] } });

    await open();

    expect(screen.getByText(de.pages.workspace.noChats)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: de.pages.workspace.startChat })).toHaveAttribute(
      "href",
      `/projects/${PROJECT}/chats/new`
    );
    expect(chatList).not.toHaveBeenCalled();
  });

  it("listet nur die eigenen Chats dieses Projekts, neueste zuerst, unter dem Pfad des Projekts", async () => {
    withTables({
      tables: {
        conversations: [
          conversation(1),
          conversation(2, { messages: null }),
          conversation(3, { user_id: "user-2" }),
          conversation(4, { project_id: "p-andere" }),
        ],
      },
    });

    await open();

    expect(chatList.mock.lastCall?.[0]).toMatchObject({
      userId: "user-1",
      basePath: `/projects/${PROJECT}/chats`,
      chats: [
        { id: "c-2", title: "Chat 2", messageCount: 0 },
        { id: "c-1", title: "Chat 1", messageCount: 2 },
      ],
    });
    expect(screen.getByRole("link", { name: de.pages.workspace.newChatHere })).toHaveAttribute(
      "href",
      `/projects/${PROJECT}/chats/new`
    );
    expectScoped("conversations");
  });

  it.each([
    [LIST_LOAD_LIMIT, false],
    [LIST_LOAD_LIMIT + 1, true],
  ])("zeigt von %i Chats höchstens die Grenze und sagt, ob welche fehlen", async (total, hint) => {
    withTables({ tables: { conversations: Array.from({ length: total }, (_, i) => conversation(i)) } });

    await open();

    expect((chatList.mock.lastCall?.[0] as { chats: unknown[] }).chats).toHaveLength(LIST_LOAD_LIMIT);
    expect(screen.queryByText(truncated) !== null).toBe(hint);
  });

  it("wirft bei einem Lesefehler, statt 'noch keine Chats' zu zeigen", async () => {
    withTables({ errors: { conversations: "timeout" } });
    await expect(open()).rejects.toThrow("database read failed: conversations");
  });
});

describe("Ergebnisse", () => {
  const open = async () => render(await ProjectResultsPage({ params: params() }));
  const prompts = () => (savedList.mock.lastCall?.[0] as { prompts: Record<string, unknown>[] }).prompts;

  it.each([
    ["ohne Chats zum ersten Chat", [], de.pages.results.startFirst, `/projects/${PROJECT}/chats/new`],
    ["mit Chats zu den Chats", [conversation(1)], de.pages.results.toChats, `/projects/${PROJECT}`],
    [
      "mit nur fremden Chats zum ersten Chat",
      [conversation(1, { user_id: "user-2" })],
      de.pages.results.startFirst,
      `/projects/${PROJECT}/chats/new`,
    ],
  ])("führt ohne gespeicherte Prompts %s", async (_name, conversations, label, href) => {
    withTables({ tables: { conversations } });

    await open();

    expect(screen.getByText(de.pages.results.noneTitle)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: label })).toHaveAttribute("href", href);
    expect(savedList).not.toHaveBeenCalled();
  });

  it("zeigt nur die eigenen Prompts dieses Projekts, neueste zuerst", async () => {
    withTables({
      tables: {
        saved_prompts: [saved(1), saved(2), saved(3, { user_id: "user-2" }), saved(4, { project_id: "p-andere" })],
      },
    });

    await open();

    expect(prompts().map((p) => [p.id, p.projectId])).toEqual([
      ["s-2", PROJECT],
      ["s-1", PROJECT],
    ]);
    expect(savedList.mock.lastCall?.[0]).toMatchObject({ userId: "user-1" });
    expect(screen.getByText(plural(de.pages.results.count, 2, "de"))).toBeInTheDocument();
    expectScoped("saved_prompts", "conversations");
  });

  it.each([
    [200, false],
    [201, true],
  ])("nennt bei %i Prompts die Zahl nur, wenn sie stimmt (gekappt: %s)", async (total, capped) => {
    withTables({ tables: { saved_prompts: Array.from({ length: total }, (_, i) => saved(i)) } });

    await open();

    expect(prompts()).toHaveLength(200);
    const text = capped ? fmt(de.pages.results.newest, { count: 200 }) : plural(de.pages.results.count, 200, "de");
    expect(screen.getByText(text)).toBeInTheDocument();
  });

  it.each(["saved_prompts", "conversations"])("wirft bei einem Lesefehler (%s)", async (table) => {
    withTables({ errors: { [table]: "timeout" } });
    await expect(open()).rejects.toThrow(`database read failed: ${table}`);
  });
});
