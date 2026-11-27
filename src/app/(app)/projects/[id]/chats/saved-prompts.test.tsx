import type { ReactNode } from "react";
import { render } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { SAVED_PROMPTS_LOAD_LIMIT } from "@/shared/lib/chat-limits";
import ProjectChatPage from "./[cid]/page";
import NewProjectChatPage from "./new/page";

// #399: Die beiden Chat-Seiten eines Projekts geben die gespeicherten Prompts mit vollem Text an den Chat weiter, sie
// stehen damit in der ausgelieferten Seite. Der Nachbau sortiert, kappt und zählt wie PostgREST: `count` nur bei
// `{ count: "exact" }`, und dann über alle passenden Zeilen, unabhängig von `limit`.
const USER = "user-1";
const PROJECT = "6f1c2d3e-4b5a-4c7d-8e9f-0a1b2c3d4e5f";
const CHAT = "0a1b2c3d-4e5f-4a6b-8c7d-9e0f1a2b3c4d";

type Row = Record<string, unknown>;
const tables: { saved_prompts: Row[]; conversations: Row[] } = {
  saved_prompts: [],
  conversations: [{ id: CHAT, user_id: USER, title: "Projektchat", project_id: PROJECT }],
};

const client = {
  from(table: keyof typeof tables) {
    const filters: [string, unknown][] = [];
    let sort: { column: string; ascending: boolean } | null = null;
    let take = Number.POSITIVE_INFINITY;
    let counted = false;
    const run = () => {
      const matching = tables[table].filter((row) => filters.every(([column, value]) => row[column] === value));
      if (sort) {
        const { column, ascending } = sort;
        matching.sort((a, b) => String(a[column]).localeCompare(String(b[column])) * (ascending ? 1 : -1));
      }
      return { data: matching.slice(0, take), count: counted ? matching.length : null, error: null };
    };
    const chain = {
      select: (_columns: string, options?: { count?: string }) => {
        counted = options?.count === "exact";
        return chain;
      },
      eq: (column: string, value: unknown) => {
        filters.push([column, value]);
        return chain;
      },
      order: (column: string, options?: { ascending?: boolean }) => {
        sort = { column, ascending: options?.ascending ?? true };
        return chain;
      },
      limit: (count: number) => {
        take = count;
        return chain;
      },
      maybeSingle: async () => ({ data: run().data[0] ?? null, error: null }),
      then: <T,>(resolve: (value: ReturnType<typeof run>) => T) => Promise.resolve(run()).then(resolve),
    };
    return chain;
  },
};

const chatProps = vi.fn();

vi.mock("next/navigation", () => ({ notFound: vi.fn(), redirect: vi.fn() }));
vi.mock("next/link", () => ({
  default: ({ href, children }: { href: string; children: ReactNode }) => <a href={href}>{children}</a>,
}));
vi.mock("@/server/project", () => ({ getProject: async () => ({ id: PROJECT, userId: USER }) }));
vi.mock("@/server/supabase/server", () => ({ createClient: async () => client }));
vi.mock("@/server/session", () => ({
  getSessionUser: async () => ({ id: USER, email: "anna@example.test" }),
  getSessionProfile: async () => ({ display_name: "Anna" }),
  getNeedsOwnKey: async () => false,
  getFreePromptsLeft: async () => null,
}));
vi.mock("@/features/chat/lib/load-messages", () => ({ loadConversationMessages: async () => [] }));
vi.mock("@/server/prompt-version-target", () => ({ loadVersionTarget: async () => null }));
vi.mock("@/server/start-from-prompt", () => ({ loadStartPrompt: async () => null }));
vi.mock("@/server/i18n", async () => {
  const { de } = await import("@/shared/i18n/messages/de");
  return { getT: async () => de };
});
vi.mock("@/shared/motion/fade-in", () => ({ FadeIn: ({ children }: { children: ReactNode }) => <div>{children}</div> }));
vi.mock("@/features/chat/components/chat", () => ({
  Chat: (props: { savedPrompts?: string[]; hasResults?: boolean }) => {
    chatProps(props);
    return null;
  },
}));

/** Eine Zeile je Minute: eine höhere Nummer ist neuer. */
function saved(number: number, overrides: Row = {}): Row {
  return {
    user_id: USER,
    project_id: PROJECT,
    created_at: new Date(Date.UTC(2026, 0, 1, 0, number)).toISOString(),
    outputs: { prompt: `Prompt ${number}` },
    ...overrides,
  };
}

const PAGES = [
  ["ProjectChatPage", () => ProjectChatPage({ params: Promise.resolve({ id: PROJECT, cid: CHAT }) })],
  [
    "NewProjectChatPage",
    () => NewProjectChatPage({ params: Promise.resolve({ id: PROJECT }), searchParams: Promise.resolve({}) }),
  ],
] as const;

describe.each(PAGES)("%s: gespeicherte Prompts des Projekts", (_name, page) => {
  beforeEach(() => {
    chatProps.mockClear();
    tables.saved_prompts = [];
  });

  const open = async () => {
    render(await page());
    return chatProps.mock.lastCall?.[0] as { savedPrompts: string[]; hasResults: boolean };
  };

  it("gibt dem Chat nur die neuesten bis zur Grenze, neueste zuerst", async () => {
    const total = SAVED_PROMPTS_LOAD_LIMIT + 5;
    // Älteste zuerst abgelegt: ohne Sortierung fielen die neuesten unter die Grenze.
    tables.saved_prompts = [
      ...Array.from({ length: total }, (_, number) => saved(number)),
      saved(total + 1, { project_id: "anderes-projekt" }),
      saved(total + 2, { user_id: "user-2" }),
    ];

    const { savedPrompts, hasResults } = await open();

    expect(savedPrompts).toEqual(
      Array.from({ length: SAVED_PROMPTS_LOAD_LIMIT }, (_, index) => `Prompt ${total - 1 - index}`)
    );
    expect(hasResults).toBe(true);
  });

  it("liest aus der Zählung, ob das Projekt Ergebnisse hat, auch wenn keine Zeile einen Text trägt", async () => {
    tables.saved_prompts = [saved(1, { outputs: null })];

    const { savedPrompts, hasResults } = await open();

    expect(savedPrompts).toEqual([]);
    expect(hasResults).toBe(true);
  });

  it("meldet ohne gespeicherte Prompts keine Ergebnisse", async () => {
    const { savedPrompts, hasResults } = await open();

    expect(savedPrompts).toEqual([]);
    expect(hasResults).toBe(false);
  });
});
