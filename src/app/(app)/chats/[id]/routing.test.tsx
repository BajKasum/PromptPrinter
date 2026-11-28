import { beforeEach, describe, expect, it, vi } from "vitest";
import { tablesClient } from "@tests/support/supabase-tables";
import ChatDetailPage from "./page";

// Wohin die Adresse eines Chats führt: eine falsch geformte Kennung ist ein 404, ein Chat eines Projekts wohnt in
// dessen Workspace, ein Lesefehler ist weder das eine noch das andere. Eigener und fremder Chat: page.test.tsx.
const CHAT = "6f1c2d3e-4b5a-4c7d-8e9f-0a1b2c3d4e5f";
const PROJECT = "0a1b2c3d-4e5f-4a6b-8c7d-9e0f1a2b3c4d";

let client = tablesClient();
const loadConversationMessages = vi.fn(async (..._args: unknown[]) => []);

vi.mock("next/navigation", () => ({
  redirect: (to: string) => {
    throw new Error(`NEXT_REDIRECT ${to}`);
  },
  notFound: () => {
    throw new Error("NEXT_NOT_FOUND");
  },
}));
vi.mock("@/server/supabase/server", () => ({ createClient: async () => client }));
vi.mock("@/server/session", () => ({
  getSessionUser: async () => ({ id: "user-1", email: "anna@example.test" }),
  getSessionProfile: async () => null,
  getNeedsOwnKey: async () => false,
  getFreePromptsLeft: async () => null,
}));
vi.mock("@/features/chat/lib/load-messages", () => ({
  loadConversationMessages: (...args: unknown[]) => loadConversationMessages(...args),
}));
vi.mock("@/server/prompt-version-target", () => ({ loadVersionTarget: async () => null }));

const page = (id: string) => ChatDetailPage({ params: Promise.resolve({ id }) });

beforeEach(() => {
  loadConversationMessages.mockClear();
  client = tablesClient({
    tables: { conversations: [{ id: CHAT, user_id: "user-1", title: "Im Projekt", project_id: PROJECT }] },
  });
});

describe("ChatDetailPage: wohin die Adresse führt", () => {
  it.each(["neu", "123", `${CHAT}x`])("ist ein 404 für die falsch geformte Kennung %j, ohne etwas zu lesen", async (id) => {
    await expect(page(id)).rejects.toThrow("NEXT_NOT_FOUND");
    expect(client.reads).toEqual([]);
  });

  it("führt den Chat eines Projekts in dessen Workspace, ohne seine Nachrichten zu laden", async () => {
    await expect(page(CHAT)).rejects.toThrow(`NEXT_REDIRECT /projects/${PROJECT}/chats/${CHAT}`);
    expect(loadConversationMessages).not.toHaveBeenCalled();
  });

  it("wirft bei einem Lesefehler, statt den Chat als 404 zu zeigen", async () => {
    client = tablesClient({ errors: { conversations: "timeout" } });
    await expect(page(CHAT)).rejects.toThrow("database read failed: conversations");
  });
});
