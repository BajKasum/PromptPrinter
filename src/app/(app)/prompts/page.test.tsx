import type { ReactNode } from "react";
import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { tablesClient, type Row } from "@tests/support/supabase-tables";
import { SAVED_PROMPTS_LOAD_LIMIT } from "@/shared/lib/chat-limits";
import { fmt, plural } from "@/shared/i18n/format";
import { de } from "@/shared/i18n/messages/de";
import SavedPromptsPage from "./page";

// Die Bibliothek aller gespeicherten Prompts: nur die eigenen, aus Chats mit und ohne Projekt, neueste zuerst,
// höchstens SAVED_PROMPTS_LOAD_LIMIT, und ehrlich beschriftet, wenn mehr da sind.
let client = tablesClient();
const list = vi.fn();

vi.mock("next/navigation", () => ({ redirect: vi.fn() }));
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
vi.mock("@/features/prompts/components/saved-prompt-list", () => ({
  SavedPromptList: (props: Record<string, unknown>) => {
    list(props);
    return <ul aria-label="Gespeicherte Prompts" />;
  },
}));

function saved(number: number, overrides: Row = {}): Row {
  return {
    id: `s-${number}`,
    user_id: "user-1",
    project_id: null,
    created_at: new Date(Date.UTC(2026, 0, 1, 0, number)).toISOString(),
    outputs: { prompt: `Prompt ${number}`, title: `Titel ${number}` },
    ...overrides,
  };
}

const prompts = () => (list.mock.lastCall?.[0] as { prompts: Record<string, unknown>[] }).prompts;

beforeEach(() => {
  list.mockClear();
  client = tablesClient();
});

describe("SavedPromptsPage", () => {
  it("zeigt nur eigene Prompts, neueste zuerst, jeder mit seinem Projekt", async () => {
    client = tablesClient({
      tables: {
        saved_prompts: [saved(1, { project_id: "p-1" }), saved(2), saved(3, { user_id: "user-2" })],
      },
    });

    render(await SavedPromptsPage());

    expect(prompts().map((p) => [p.id, p.title, p.content, p.projectId])).toEqual([
      ["s-2", "Titel 2", "Prompt 2", null],
      ["s-1", "Titel 1", "Prompt 1", "p-1"],
    ]);
    expect(list.mock.lastCall?.[0]).toMatchObject({ userId: "user-1" });
    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent(de.pages.savedPrompts.title);
    expect(screen.getByText(plural(de.pages.results.count, 2, "de"))).toBeInTheDocument();
  });

  it("zeigt ohne Prompts den Weg zum ersten Chat", async () => {
    render(await SavedPromptsPage());

    expect(screen.getByText(de.pages.results.noneTitle)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: de.pages.results.startFirst })).toHaveAttribute("href", "/chats/new");
    expect(list).not.toHaveBeenCalled();
  });

  it.each([
    [SAVED_PROMPTS_LOAD_LIMIT, false],
    [SAVED_PROMPTS_LOAD_LIMIT + 1, true],
  ])("nennt bei %i Prompts die Zahl nur, wenn sie stimmt (gekappt: %s)", async (total, capped) => {
    client = tablesClient({ tables: { saved_prompts: Array.from({ length: total }, (_, i) => saved(i)) } });

    render(await SavedPromptsPage());

    expect(prompts()).toHaveLength(SAVED_PROMPTS_LOAD_LIMIT);
    const newest = fmt(de.pages.results.newest, { count: SAVED_PROMPTS_LOAD_LIMIT });
    const exact = plural(de.pages.results.count, SAVED_PROMPTS_LOAD_LIMIT, "de");
    expect(screen.getByText(capped ? newest : exact)).toBeInTheDocument();
    expect(client.reads[0].range).toEqual([0, SAVED_PROMPTS_LOAD_LIMIT]);
  });

  it("wirft bei einem Lesefehler, statt 'noch nichts gespeichert' zu zeigen", async () => {
    client = tablesClient({ errors: { saved_prompts: "timeout" } });
    await expect(SavedPromptsPage()).rejects.toThrow("database read failed: saved_prompts");
  });
});
