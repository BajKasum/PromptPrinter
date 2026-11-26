import type { ReactNode } from "react";
import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { rowsClient } from "@tests/support/supabase-rows";
import ChatDetailPage from "./page";

// #398: Die Seite las den Chat allein über RLS. Der Nachbau liefert jede Zeile, die die Abfrage selbst durchlässt,
// wie eine Datenbank, deren Policy zu weit geht: ohne `.eq("user_id", …)` öffnete sie dann einen fremden Chat.
const OWN = "6f1c2d3e-4b5a-4c7d-8e9f-0a1b2c3d4e5f";
const FOREIGN = "0a1b2c3d-4e5f-4a6b-8c7d-9e0f1a2b3c4d";
const client = rowsClient({
  conversations: [
    { id: OWN, user_id: "user-1", title: "Eigener Chat", project_id: null },
    { id: FOREIGN, user_id: "user-2", title: "Fremder Chat", project_id: null },
  ],
  saved_prompts: [],
});
const notFound = vi.fn(() => {
  throw new Error("NEXT_NOT_FOUND");
});
const loadConversationMessages = vi.fn(async (..._args: unknown[]) => []);

vi.mock("next/navigation", () => ({ notFound: () => notFound(), redirect: vi.fn() }));
vi.mock("next/link", () => ({
  default: ({ href, children }: { href: string; children: ReactNode }) => <a href={href}>{children}</a>,
}));
vi.mock("@/server/supabase/server", () => ({ createClient: async () => client }));
vi.mock("@/server/session", () => ({
  getSessionUser: async () => ({ id: "user-1", email: "anna@example.test" }),
  getSessionProfile: async () => ({ display_name: "Anna" }),
  getNeedsOwnKey: async () => false,
  getFreePromptsLeft: async () => null,
}));
vi.mock("@/features/chat/lib/load-messages", () => ({
  loadConversationMessages: (...args: unknown[]) => loadConversationMessages(...args),
}));
vi.mock("@/server/prompt-version-target", () => ({ loadVersionTarget: async () => null }));
vi.mock("@/server/i18n", async () => {
  const { de } = await import("@/shared/i18n/messages/de");
  return { getT: async () => de };
});
vi.mock("@/shared/motion/fade-in", () => ({ FadeIn: ({ children }: { children: ReactNode }) => <div>{children}</div> }));
vi.mock("@/features/chat/components/chat", () => ({
  Chat: ({ initialConversationId }: { initialConversationId: string }) => (
    <section aria-label="Chat" data-conversation={initialConversationId} />
  ),
}));

const page = (id: string) => ChatDetailPage({ params: Promise.resolve({ id }) });

describe("ChatDetailPage", () => {
  beforeEach(() => {
    client.reads.length = 0;
    notFound.mockClear();
    loadConversationMessages.mockClear();
  });

  it("öffnet den eigenen Chat", async () => {
    render(await page(OWN));
    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent("Eigener Chat");
    expect(screen.getByRole("region", { name: "Chat" })).toHaveAttribute("data-conversation", OWN);
  });

  it("öffnet einen fremden Chat nicht, auch wenn RLS die Zeile durchliesse", async () => {
    await expect(page(FOREIGN)).rejects.toThrow("NEXT_NOT_FOUND");
    expect(notFound).toHaveBeenCalledTimes(1);
    expect(loadConversationMessages).not.toHaveBeenCalled();
  });

  it("liest den Chat mit der Kennung aus der geprüften Sitzung", async () => {
    await page(OWN);
    const read = client.reads.find((r) => r.table === "conversations");
    expect(read?.filters).toEqual(expect.arrayContaining([["eq", "id", OWN], ["eq", "user_id", "user-1"]]));
  });
});
