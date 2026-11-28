import type { ReactNode } from "react";
import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { tablesClient, type Row } from "@tests/support/supabase-tables";
import { LIST_LOAD_LIMIT } from "@/shared/lib/chat-limits";
import { fmt } from "@/shared/i18n/format";
import { de } from "@/shared/i18n/messages/de";
import ProjectsPage from "./page";

// "Projekte": nur die eigenen, neueste zuerst, höchstens LIST_LOAD_LIMIT; die Zahlen je Projekt kommen aus
// project_summaries() und gehören zum Projekt mit derselben Kennung.
let client = tablesClient();
const browser = vi.fn();

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
      {action && <div data-testid="header-action">{action}</div>}
    </header>
  ),
}));
vi.mock("@/features/projects/components/new-project", () => ({
  NewProjectButton: () => <button type="button">Neues Projekt</button>,
}));
vi.mock("@/features/prompts/components/library-browser", () => ({
  LibraryBrowser: (props: Record<string, unknown>) => {
    browser(props);
    return <ul aria-label="Projekte" />;
  },
}));

function project(number: number, overrides: Row = {}): Row {
  return {
    id: `p-${number}`,
    user_id: "user-1",
    name: `Projekt ${number}`,
    updated_at: new Date(Date.UTC(2026, 0, 1, 0, number)).toISOString(),
    is_favorite: false,
    ...overrides,
  };
}

const items = () =>
  (browser.mock.lastCall?.[0] as { items: Record<string, unknown>[] }).items;
const truncated = fmt(de.pages.projects.truncated, { count: LIST_LOAD_LIMIT });

beforeEach(() => {
  browser.mockClear();
  client = tablesClient();
});

describe("ProjectsPage", () => {
  it("zeigt nur eigene Projekte, neueste zuerst, mit den Zahlen aus project_summaries", async () => {
    client = tablesClient({
      tables: { projects: [project(1, { is_favorite: true }), project(2), project(3, { user_id: "user-2" })] },
      rpc: {
        project_summaries: [
          { project_id: "p-1", chat_count: 4, saved_count: 2 },
          { project_id: "p-3", chat_count: 9, saved_count: 9 },
        ],
      },
    });

    render(await ProjectsPage());

    expect(items()).toEqual([
      { id: "p-2", name: "Projekt 2", updatedAt: project(2).updated_at, savedPromptCount: 0, chatCount: 0, isFavorite: false },
      { id: "p-1", name: "Projekt 1", updatedAt: project(1).updated_at, savedPromptCount: 2, chatCount: 4, isFavorite: true },
    ]);
    expect(browser.mock.lastCall?.[0]).toMatchObject({ userId: "user-1" });
    expect(screen.getByTestId("header-action")).toBeInTheDocument();
    expect(screen.queryByText(de.pages.projects.emptySubtitle)).not.toBeInTheDocument();
    expect(client.rpcCalls).toEqual(["project_summaries"]);
  });

  it("zeigt ohne Projekte den Einstieg samt Knopf und dem Weg zum Chat", async () => {
    render(await ProjectsPage());

    expect(screen.getByText(de.pages.projects.emptyTitle)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Neues Projekt" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: de.pages.projects.orChat })).toHaveAttribute("href", "/chats/new");
    expect(screen.queryByTestId("header-action")).not.toBeInTheDocument();
    expect(browser).not.toHaveBeenCalled();
  });

  it.each([
    [LIST_LOAD_LIMIT, false],
    [LIST_LOAD_LIMIT + 1, true],
  ])("zeigt von %i Projekten höchstens %i und sagt, ob welche fehlen", async (total, hint) => {
    client = tablesClient({ tables: { projects: Array.from({ length: total }, (_, i) => project(i)) } });

    render(await ProjectsPage());

    expect(items()).toHaveLength(Math.min(total, LIST_LOAD_LIMIT));
    expect(screen.queryByText(truncated) !== null).toBe(hint);
    expect(client.reads[0].range).toEqual([0, LIST_LOAD_LIMIT]);
  });

  it.each(["projects", "project_summaries"])("wirft bei einem Lesefehler (%s), statt Zahlen zu erfinden", async (name) => {
    client = tablesClient({ tables: { projects: [project(1)] }, errors: { [name]: "timeout" } });
    await expect(ProjectsPage()).rejects.toThrow(`database read failed: ${name}`);
  });
});
