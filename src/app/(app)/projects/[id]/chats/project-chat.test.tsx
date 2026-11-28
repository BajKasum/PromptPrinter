import type { ReactNode } from "react";
import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { tablesClient } from "@tests/support/supabase-tables";
import ProjectChatPage from "./[cid]/page";
import NewProjectChatPage from "./new/page";

// Ein Chat im Projekt: eine falsch geformte, unbekannte oder fremde Kennung ist ein 404; ein Chat, der anderswo wohnt,
// führt dorthin. Gelesen wird erst, wenn der Chat dem Konto gehört. getProject() läuft hier mit. Welche gespeicherten
// Prompts die Seiten weitergeben, steht in saved-prompts.test.tsx.
const PROJECT = "6f1c2d3e-4b5a-4c7d-8e9f-0a1b2c3d4e5f";
const OTHER_PROJECT = "7a2d3e4f-5c6b-4d8e-9f0a-1b2c3d4e5f60";
const FOREIGN_PROJECT = "0a1b2c3d-4e5f-4a6b-8c7d-9e0f1a2b3c4d";
const CHAT = "11111111-2222-4333-8444-555555555555";
const GLOBAL_CHAT = "22222222-3333-4444-8555-666666666666";
const ELSEWHERE_CHAT = "33333333-4444-4555-8666-777777777777";
const FOREIGN_CHAT = "44444444-5555-4666-8777-888888888888";
const UNKNOWN = "55555555-6666-4777-8888-999999999999";

const project = (id: string, userId: string) => ({
  id,
  user_id: userId,
  name: "Projekt",
  instructions: null,
  context: {},
  audience: null,
  idea: null,
  type: "general",
  is_favorite: false,
  updated_at: "2026-11-01T10:00:00.000Z",
});

let client = tablesClient();
const loadConversationMessages = vi.fn(async (..._args: unknown[]) => []);
const loadStartPrompt = vi.fn(async (..._args: unknown[]): Promise<string | null> => null);
const loadVersionTarget = vi.fn(async (..._args: unknown[]): Promise<{ id: string } | null> => null);
const chat = vi.fn();

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
vi.mock("@/server/session", () => ({
  getSessionUser: async () => ({ id: "user-1", email: "anna@example.test" }),
  getSessionProfile: async () => ({ display_name: null }),
  getNeedsOwnKey: async () => true,
  getFreePromptsLeft: async () => null,
}));
vi.mock("@/features/chat/lib/load-messages", () => ({
  loadConversationMessages: (...args: unknown[]) => loadConversationMessages(...args),
}));
vi.mock("@/server/start-from-prompt", () => ({ loadStartPrompt: (...args: unknown[]) => loadStartPrompt(...args) }));
vi.mock("@/server/prompt-version-target", () => ({
  loadVersionTarget: (...args: unknown[]) => loadVersionTarget(...args),
}));
vi.mock("@/server/i18n", async () => {
  const { de } = await import("@/shared/i18n/messages/de");
  return { getT: async () => de };
});
vi.mock("@/shared/motion/fade-in", () => ({ FadeIn: ({ children }: { children: ReactNode }) => <div>{children}</div> }));
vi.mock("@/features/chat/components/chat", () => ({
  Chat: (props: Record<string, unknown>) => {
    chat(props);
    return null;
  },
}));

const open = (cid: string, id = PROJECT) => ProjectChatPage({ params: Promise.resolve({ id, cid }) });
const openNew = (id = PROJECT, from?: string) =>
  NewProjectChatPage({ params: Promise.resolve({ id }), searchParams: Promise.resolve(from ? { from } : {}) });

beforeEach(() => {
  loadConversationMessages.mockClear();
  loadStartPrompt.mockReset();
  loadStartPrompt.mockResolvedValue(null);
  loadVersionTarget.mockReset();
  loadVersionTarget.mockResolvedValue(null);
  chat.mockClear();
  client = tablesClient({
    tables: {
      projects: [project(PROJECT, "user-1"), project(OTHER_PROJECT, "user-1"), project(FOREIGN_PROJECT, "user-2")],
      conversations: [
        { id: CHAT, user_id: "user-1", title: "Rezepte planen", project_id: PROJECT },
        { id: GLOBAL_CHAT, user_id: "user-1", title: "Ohne Projekt", project_id: null },
        { id: ELSEWHERE_CHAT, user_id: "user-1", title: "Woanders", project_id: OTHER_PROJECT },
        { id: FOREIGN_CHAT, user_id: "user-2", title: "Fremd", project_id: PROJECT },
      ],
      saved_prompts: [],
    },
  });
});

describe("ProjectChatPage", () => {
  it("öffnet den eigenen Chat des Projekts", async () => {
    render(await open(CHAT));

    expect(screen.getByRole("heading", { level: 2 })).toHaveTextContent("Rezepte planen");
    expect(screen.getByRole("link")).toHaveAttribute("href", `/projects/${PROJECT}`);
    expect(loadConversationMessages).toHaveBeenCalledWith(client, "user-1", CHAT);
    expect(loadVersionTarget).toHaveBeenCalledWith(client, "user-1", { conversationId: CHAT });
    expect(chat.mock.lastCall?.[0]).toMatchObject({
      projectId: PROJECT,
      initialConversationId: CHAT,
      needsKey: true,
      // Ohne Anzeigenamen steht der Teil der Adresse vor dem @.
      name: "anna",
    });
  });

  it.each(["neu", "123", `${CHAT}x`])("ist ein 404 für die falsch geformte Kennung %j, ohne etwas zu lesen", async (cid) => {
    await expect(open(cid)).rejects.toThrow("NEXT_NOT_FOUND");
    expect(client.reads).toEqual([]);
  });

  it.each([
    ["einen unbekannten Chat", UNKNOWN, PROJECT],
    ["einen fremden Chat, auch wenn RLS die Zeile durchliesse", FOREIGN_CHAT, PROJECT],
    ["ein fremdes Projekt", CHAT, FOREIGN_PROJECT],
  ])("ist ein 404 für %s und lädt keine Nachrichten", async (_name, cid, id) => {
    await expect(open(cid, id)).rejects.toThrow("NEXT_NOT_FOUND");
    expect(loadConversationMessages).not.toHaveBeenCalled();
    expect(client.reads.map((read) => read.table)).not.toContain("saved_prompts");
  });

  it.each([
    ["ein Chat ohne Projekt zur globalen Adresse", GLOBAL_CHAT, `/chats/${GLOBAL_CHAT}`],
    ["ein Chat eines anderen Projekts in dessen Workspace", ELSEWHERE_CHAT, `/projects/${OTHER_PROJECT}/chats/${ELSEWHERE_CHAT}`],
  ])("führt %s", async (_name, cid, to) => {
    await expect(open(cid)).rejects.toThrow(`NEXT_REDIRECT ${to}`);
    expect(loadConversationMessages).not.toHaveBeenCalled();
  });

  it("liest den Chat mit der Kennung aus der geprüften Sitzung", async () => {
    await open(CHAT);
    const read = client.reads.find((r) => r.table === "conversations");
    expect(read?.filters).toEqual([
      ["eq", "id", CHAT],
      ["eq", "user_id", "user-1"],
    ]);
  });

  it.each(["conversations", "saved_prompts"])("wirft bei einem Lesefehler (%s)", async (table) => {
    client = tablesClient({
      tables: {
        projects: [project(PROJECT, "user-1")],
        conversations: [{ id: CHAT, user_id: "user-1", title: "Rezepte planen", project_id: PROJECT }],
      },
      errors: { [table]: "timeout" },
    });
    await expect(open(CHAT)).rejects.toThrow(`database read failed: ${table}`);
  });
});

describe("NewProjectChatPage", () => {
  it("ist für ein fremdes Projekt ein 404, bevor ein Prompt gelesen wird", async () => {
    await expect(openNew(FOREIGN_PROJECT, UNKNOWN)).rejects.toThrow("NEXT_NOT_FOUND");
    expect(loadStartPrompt).not.toHaveBeenCalled();
    expect(client.reads.map((read) => read.table)).toEqual(["projects"]);
  });

  it("startet leer im Projekt und führt zurück zur Übersicht", async () => {
    render(await openNew());

    expect(screen.getByRole("link")).toHaveAttribute("href", `/projects/${PROJECT}`);
    expect(chat.mock.lastCall?.[0]).toMatchObject({ projectId: PROJECT, hasResults: false });
    expect(chat.mock.lastCall?.[0]).toMatchObject({ initialInput: undefined, fromPromptId: undefined });
  });

  it("legt mit ?from= den eigenen Prompt ins Eingabefeld, mit der Kennung des Kontos nachgeschlagen", async () => {
    loadStartPrompt.mockResolvedValue("Schreib eine Einladung.");
    loadVersionTarget.mockResolvedValue({ id: UNKNOWN });

    render(await openNew(PROJECT, UNKNOWN));

    expect(loadStartPrompt).toHaveBeenCalledWith(client, "user-1", UNKNOWN);
    expect(loadVersionTarget).toHaveBeenCalledWith(client, "user-1", { from: UNKNOWN });
    expect(chat.mock.lastCall?.[0]).toMatchObject({
      initialInput: "Pass diesen Prompt an: \n\nSchreib eine Einladung.",
      fromPromptId: UNKNOWN,
      versionTarget: { id: UNKNOWN },
    });
  });
});
