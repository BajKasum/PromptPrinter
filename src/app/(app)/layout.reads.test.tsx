import type { ReactNode } from "react";
import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { tablesClient } from "@tests/support/supabase-tables";
import { de } from "@/shared/i18n/messages/de";
import { en } from "@/shared/i18n/messages/en";
import AppLayout from "./layout";

// Das Gerüst der App: ein Lesefehler der Seitenleiste lässt die Seite darunter stehen, die Sprache kommt aus dem Cookie,
// sonst aus dem Profil, und Zustand und Breite der Seitenleiste aus ihren Cookies. Dass die Listen nur eigene Zeilen
// zeigen, steht in layout.test.tsx.
let client = tablesClient();
let jar: Record<string, string> = {};
let settings: unknown = null;
const captureError = vi.fn();
const sidebar = vi.fn();
const i18n = vi.fn();

vi.mock("next/navigation", () => ({ redirect: vi.fn() }));
vi.mock("next/headers", () => ({
  cookies: async () => ({ get: (name: string) => (name in jar ? { name, value: jar[name] } : undefined) }),
  headers: async () => new Headers(),
}));
vi.mock("@/server/supabase/server", () => ({ createClient: async () => client }));
vi.mock("@/server/session", () => ({
  getSessionUser: async () => ({ id: "user-1", email: "anna@example.test" }),
  getSessionProfile: async () => ({ display_name: "Anna", is_admin: false, settings }),
}));
vi.mock("@/shared/lib/observability", () => ({ captureError: (...args: unknown[]) => captureError(...args) }));
vi.mock("@/shell/components/sidebar", () => ({
  Sidebar: (props: Record<string, unknown>) => {
    sidebar(props);
    return null;
  },
}));
vi.mock("@/shell/components/mobile-nav", () => ({ MobileNav: () => null }));
vi.mock("@/shared/providers/theme-provider", () => ({ ThemeProvider: ({ children }: { children: ReactNode }) => children }));
vi.mock("@/shared/ui/toast", () => ({ ToastProvider: ({ children }: { children: ReactNode }) => children }));
vi.mock("@/shared/i18n/provider", () => ({
  I18nProvider: (props: { children: ReactNode }) => {
    i18n(props);
    return props.children;
  },
}));

const open = async () => render(await AppLayout({ children: <p>Seite darunter</p> }));
const sidebarProps = () => sidebar.mock.lastCall?.[0] as Record<string, unknown>;
const i18nProps = () => i18n.mock.lastCall?.[0] as Record<string, unknown>;

beforeEach(() => {
  jar = {};
  settings = null;
  captureError.mockClear();
  sidebar.mockClear();
  i18n.mockClear();
  client = tablesClient({
    tables: {
      conversations: [{ id: "c-1", user_id: "user-1", title: "Chat", project_id: null }],
      projects: [{ id: "p-1", user_id: "user-1", name: "Projekt", is_favorite: null }],
    },
  });
});

describe("AppLayout: Lesefehler der Seitenleiste", () => {
  it.each([
    ["conversations", "sidebar.chats_read_failed", { chats: [], projects: [{ id: "p-1", name: "Projekt", isFavorite: false }] }],
    ["projects", "sidebar.projects_read_failed", { chats: [{ id: "c-1", title: "Chat" }], projects: [] }],
  ])("bei %s: Meldung, leere Liste, die Seite geht auf", async (table, event, lists) => {
    client = tablesClient({
      tables: {
        conversations: [{ id: "c-1", user_id: "user-1", title: "Chat", project_id: null }],
        projects: [{ id: "p-1", user_id: "user-1", name: "Projekt", is_favorite: null }],
      },
      errors: { [table]: "timeout" },
    });

    await open();

    expect(screen.getByText("Seite darunter")).toBeInTheDocument();
    expect(captureError).toHaveBeenCalledTimes(1);
    expect(captureError).toHaveBeenCalledWith(event, { message: "timeout" });
    expect(sidebarProps()).toMatchObject(lists);
  });

  it("holt je Liste höchstens fünf Zeilen", async () => {
    await open();
    expect(client.reads.map((read) => read.limit)).toEqual([5, 5]);
  });
});

describe("AppLayout: Sprache", () => {
  it("ist ohne Cookie und Profil Deutsch und schreibt keinen Cookie", async () => {
    await open();
    expect(i18nProps()).toMatchObject({ locale: "de", messages: de, persistCookie: false });
    expect(screen.getByRole("link", { name: de.shell.skipToContent })).toHaveAttribute("href", "#main-content");
  });

  it("nimmt die im Profil gespeicherte Wahl und schreibt den Cookie nach", async () => {
    settings = { locale: "en" };
    await open();
    expect(i18nProps()).toMatchObject({ locale: "en", messages: en, persistCookie: true });
    expect(screen.getByRole("link", { name: en.shell.skipToContent })).toBeInTheDocument();
  });

  it("zieht den Cookie dem Profil vor", async () => {
    settings = { locale: "en" };
    jar = { "pp-locale": "de" };
    await open();
    expect(i18nProps()).toMatchObject({ locale: "de", persistCookie: false });
  });

  it("ignoriert einen unbekannten Cookie-Wert", async () => {
    settings = { locale: "en" };
    jar = { "pp-locale": "xx" };
    await open();
    expect(i18nProps()).toMatchObject({ locale: "en", persistCookie: true });
  });
});

describe("AppLayout: Cookies der Seitenleiste", () => {
  it.each<[Record<string, string>, boolean, number]>([
    [{}, false, 264],
    [{ "pp-sidebar": "1", "pp-sidebar-width": "320" }, true, 320],
    [{ "pp-sidebar": "0", "pp-sidebar-width": "abc" }, false, 264],
    [{ "pp-sidebar-width": "-5" }, false, 264],
    [{ "pp-sidebar-width": "0" }, false, 264],
  ])("%j: eingeklappt %s, Breite %i", async (cookies, collapsed, width) => {
    jar = cookies;
    await open();
    expect(sidebarProps()).toMatchObject({ initialCollapsed: collapsed, initialWidth: width });
  });
});
