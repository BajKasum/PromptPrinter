import type { ReactNode } from "react";
import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { tablesClient, type Row } from "@tests/support/supabase-tables";
import { LIST_LOAD_LIMIT } from "@/shared/lib/chat-limits";
import { fmt } from "@/shared/i18n/format";
import { de } from "@/shared/i18n/messages/de";
import ChatsPage from "./page";

// "Deine Chats": nur die eigenen Chats ohne Projekt, neueste zuerst, höchstens LIST_LOAD_LIMIT, und ein Hinweis, wenn
// etwas fehlt. Ein Lesefehler ist keine leere Liste.
let client = tablesClient();
const chatList = vi.fn();

vi.mock("next/navigation", () => ({ redirect: vi.fn() }));
vi.mock("next/link", () => ({
  default: ({ href, children }: { href: string; children: ReactNode }) => <a href={href}>{children}</a>,
}));
vi.mock("@/server/supabase/server", () => ({ createClient: async () => client }));
vi.mock("@/server/session", () => ({ getSessionUser: async () => ({ id: "user-1" }) }));
vi.mock("@/server/i18n", async () => {
  const { de } = await import("@/shared/i18n/messages/de");
  return { getT: async () => de };
});
vi.mock("@/shared/motion/fade-in", () => ({ FadeIn: ({ children }: { children: ReactNode }) => <div>{children}</div> }));
vi.mock("@/shell/components/app-header", () => ({
  AppHeader: ({ title, subtitle, action }: { title: string; subtitle?: string; action?: ReactNode }) => (
    <header>
      <h1>{title}</h1>
      {subtitle && <p>{subtitle}</p>}
      {action}
    </header>
  ),
}));
vi.mock("@/features/chat/components/chat-list", () => ({
  ChatList: (props: Record<string, unknown>) => {
    chatList(props);
    return <ul aria-label="Chats" />;
  },
}));

/** Eine höhere Nummer ist neuer. */
function conversation(number: number, overrides: Row = {}): Row {
  return {
    id: `c-${number}`,
    user_id: "user-1",
    project_id: null,
    title: `Chat ${number}`,
    updated_at: new Date(Date.UTC(2026, 0, 1, 0, number)).toISOString(),
    messages: [{ count: number }],
    ...overrides,
  };
}

const shown = () => chatList.mock.lastCall?.[0] as { chats: { id: string; messageCount: number }[]; userId: string };
const truncated = fmt(de.pages.chats.truncated, { count: LIST_LOAD_LIMIT });

beforeEach(() => {
  chatList.mockClear();
  client = tablesClient();
});

describe("ChatsPage", () => {
  it("zeigt nur die eigenen Chats ohne Projekt, neueste zuerst, mit der Zahl der Nachrichten", async () => {
    client = tablesClient({
      tables: {
        conversations: [
          conversation(1),
          conversation(3),
          conversation(2, { messages: [] }),
          conversation(4, { project_id: "p-1" }),
          conversation(5, { user_id: "user-2" }),
        ],
      },
    });

    render(await ChatsPage());

    expect(shown().chats.map((chat) => [chat.id, chat.messageCount])).toEqual([
      ["c-3", 3],
      ["c-2", 0],
      ["c-1", 1],
    ]);
    expect(shown().userId).toBe("user-1");
    expect(screen.getByRole("link", { name: de.nav.newChat })).toHaveAttribute("href", "/chats/new");
    expect(screen.queryByText(de.pages.chats.emptyTitle)).not.toBeInTheDocument();
    expect(screen.queryByText(de.pages.chats.emptySubtitle)).not.toBeInTheDocument();
  });

  it("zeigt ohne Chats den Einstieg statt einer leeren Liste", async () => {
    client = tablesClient({ tables: { conversations: [conversation(1, { user_id: "user-2" })] } });

    render(await ChatsPage());

    expect(screen.getByText(de.pages.chats.emptyTitle)).toBeInTheDocument();
    expect(screen.getByText(de.pages.chats.emptySubtitle)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: de.pages.chats.startFirst })).toHaveAttribute("href", "/chats/new");
    expect(screen.queryByRole("link", { name: de.nav.newChat })).not.toBeInTheDocument();
    expect(chatList).not.toHaveBeenCalled();
  });

  it.each([
    [LIST_LOAD_LIMIT, LIST_LOAD_LIMIT, false],
    [LIST_LOAD_LIMIT + 1, LIST_LOAD_LIMIT, true],
    [LIST_LOAD_LIMIT + 40, LIST_LOAD_LIMIT, true],
  ])("zeigt von %i Chats %i und sagt, ob welche fehlen (%s)", async (total, listed, hint) => {
    client = tablesClient({ tables: { conversations: Array.from({ length: total }, (_, i) => conversation(i)) } });

    render(await ChatsPage());

    expect(shown().chats).toHaveLength(listed);
    expect(shown().chats[0].id).toBe(`c-${total - 1}`);
    expect(screen.queryByText(truncated) !== null).toBe(hint);
    // Gelesen wird eine Zeile mehr als gezeigt, nie alles.
    expect(client.reads[0].range).toEqual([0, LIST_LOAD_LIMIT]);
  });

  it("wirft bei einem Lesefehler, statt 'noch kein Gespräch' zu zeigen", async () => {
    client = tablesClient({ errors: { conversations: "timeout" } });
    await expect(ChatsPage()).rejects.toThrow("database read failed: conversations");
  });
});
