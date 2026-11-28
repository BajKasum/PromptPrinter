import { beforeEach, describe, expect, it, vi } from "vitest";
import { tablesClient } from "@tests/support/supabase-tables";
import ChatsPage from "./chats/page";
import ChatDetailPage from "./chats/[id]/page";
import NewChatPage from "./chats/new/page";
import AppLayout from "./layout";
import ProjectsPage from "./projects/page";
import ProjectWorkspaceLayout from "./projects/[id]/(workspace)/layout";
import ProjectOverviewPage from "./projects/[id]/(workspace)/page";
import ProjectResultsPage from "./projects/[id]/(workspace)/results/page";
import ProjectChatPage from "./projects/[id]/chats/[cid]/page";
import NewProjectChatPage from "./projects/[id]/chats/new/page";
import SavedPromptsPage from "./prompts/page";
import SettingsPage from "./settings/page";
import UsagePage from "./usage/page";

// Ohne Sitzung führt jede Seite der App zur Anmeldung, bevor sie etwas liest. Die Middleware sperrt dieselben Routen,
// das hier ist die zweite Linie. Die Workspace-Seiten bekommen die Weiterleitung aus getProject(); hier läuft das echte
// Modul (server/project.ts).
const ID = "6f1c2d3e-4b5a-4c7d-8e9f-0a1b2c3d4e5f";

const client = tablesClient();
const adminClient = vi.fn();

vi.mock("next/navigation", () => ({
  redirect: (to: string) => {
    throw new Error(`NEXT_REDIRECT ${to}`);
  },
  notFound: () => {
    throw new Error("NEXT_NOT_FOUND");
  },
}));
vi.mock("next/headers", () => ({
  cookies: async () => ({ get: () => undefined }),
  headers: async () => new Headers(),
}));
vi.mock("@/server/supabase/server", () => ({ createClient: async () => client }));
vi.mock("@/server/supabase/admin", () => ({ createAdminClient: () => adminClient() }));
vi.mock("@/server/session", () => ({
  getSessionUser: async () => null,
  getSessionProfile: async () => null,
  getNeedsOwnKey: async () => false,
  getFreePromptsLeft: async () => null,
}));
vi.mock("@/server/i18n", async () => {
  const { de } = await import("@/shared/i18n/messages/de");
  return { getT: async () => de, getLocale: async () => "de", messagesFor: () => de, localeFromSettings: () => null };
});

const params = Promise.resolve({ id: ID, cid: ID });
const searchParams = Promise.resolve({});

const PAGES: [string, () => Promise<unknown>][] = [
  ["AppLayout", () => AppLayout({ children: null })],
  ["/chats", () => ChatsPage()],
  ["/chats/[id]", () => ChatDetailPage({ params })],
  ["/chats/new", () => NewChatPage({ searchParams })],
  ["/projects", () => ProjectsPage()],
  ["Workspace-Layout", () => ProjectWorkspaceLayout({ params, children: null })],
  ["/projects/[id]", () => ProjectOverviewPage({ params })],
  ["/projects/[id]/results", () => ProjectResultsPage({ params })],
  ["/projects/[id]/chats/[cid]", () => ProjectChatPage({ params })],
  ["/projects/[id]/chats/new", () => NewProjectChatPage({ params, searchParams })],
  ["/prompts", () => SavedPromptsPage()],
  ["/settings", () => SettingsPage()],
  ["/usage", () => UsagePage()],
];

describe("Seiten der App ohne Sitzung", () => {
  beforeEach(() => {
    client.reads.length = 0;
    client.rpcCalls.length = 0;
    adminClient.mockClear();
  });

  it.each(PAGES)("%s führt zur Anmeldung und liest nichts", async (_name, page) => {
    await expect(page()).rejects.toThrow("NEXT_REDIRECT /login");
    expect(client.reads).toEqual([]);
    expect(client.rpcCalls).toEqual([]);
    expect(adminClient).not.toHaveBeenCalled();
  });
});
