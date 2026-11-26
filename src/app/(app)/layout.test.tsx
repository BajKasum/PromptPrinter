import type { ReactNode } from "react";
import { render, screen, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { rowsClient } from "@tests/support/supabase-rows";
import AppLayout from "./layout";

// #398: Die Seitenleiste las Chats und Projekte allein über RLS. Ginge eine Policy zu weit, etwa für geteilte
// Projekte, zeigte sie fremde Titel. Der Nachbau liefert jede Zeile, die die Abfrage selbst durchlässt.
const client = rowsClient({
  conversations: [
    { id: "c-own", user_id: "user-1", title: "Eigener Chat", project_id: null },
    { id: "c-own-project", user_id: "user-1", title: "Chat im Projekt", project_id: "p-own" },
    { id: "c-foreign", user_id: "user-2", title: "Fremder Chat", project_id: null },
  ],
  projects: [
    { id: "p-own", user_id: "user-1", name: "Eigenes Projekt", is_favorite: false },
    { id: "p-foreign", user_id: "user-2", name: "Fremdes Projekt", is_favorite: true },
  ],
});
const captureError = vi.fn();

vi.mock("next/navigation", () => ({ redirect: vi.fn() }));
vi.mock("next/headers", () => ({
  cookies: async () => ({ get: () => undefined }),
  headers: async () => new Headers(),
}));
vi.mock("@/server/supabase/server", () => ({ createClient: async () => client }));
vi.mock("@/server/session", () => ({
  getSessionUser: async () => ({ id: "user-1", email: "anna@example.test" }),
  getSessionProfile: async () => ({ display_name: "Anna", is_admin: false, settings: null }),
}));
vi.mock("@/shared/lib/observability", () => ({ captureError: (...args: unknown[]) => captureError(...args) }));
vi.mock("@/shell/components/sidebar", () => ({
  Sidebar: ({ chats, projects }: { chats: { id: string; title: string }[]; projects: { id: string; name: string }[] }) => (
    <nav aria-label="Seitenleiste">
      <ul aria-label="Chats">
        {chats.map((chat) => (
          <li key={chat.id}>{chat.title}</li>
        ))}
      </ul>
      <ul aria-label="Projekte">
        {projects.map((project) => (
          <li key={project.id}>{project.name}</li>
        ))}
      </ul>
    </nav>
  ),
}));
vi.mock("@/shell/components/mobile-nav", () => ({ MobileNav: () => null }));
vi.mock("@/shared/providers/theme-provider", () => ({ ThemeProvider: ({ children }: { children: ReactNode }) => children }));
vi.mock("@/shared/ui/toast", () => ({ ToastProvider: ({ children }: { children: ReactNode }) => children }));

describe("AppLayout, Seitenleiste", () => {
  beforeEach(() => {
    client.reads.length = 0;
    captureError.mockClear();
  });

  it("zeigt nur eigene Chats und Projekte, auch wenn RLS fremde Zeilen durchliesse", async () => {
    render(await AppLayout({ children: <p>Seite</p> }));
    const sidebar = screen.getByRole("navigation", { name: "Seitenleiste" });
    const chats = within(within(sidebar).getByRole("list", { name: "Chats" }));
    const projects = within(within(sidebar).getByRole("list", { name: "Projekte" }));

    expect(chats.getAllByRole("listitem").map((item) => item.textContent)).toEqual(["Eigener Chat"]);
    expect(projects.getAllByRole("listitem").map((item) => item.textContent)).toEqual(["Eigenes Projekt"]);
    expect(captureError).not.toHaveBeenCalled();
  });

  it("grenzt beide Listen mit der Kennung aus der geprüften Sitzung ein", async () => {
    await AppLayout({ children: null });
    expect(client.reads.map((read) => read.table).sort()).toEqual(["conversations", "projects"]);
    for (const read of client.reads) expect(read.filters, read.table).toContainEqual(["eq", "user_id", "user-1"]);
  });
});
