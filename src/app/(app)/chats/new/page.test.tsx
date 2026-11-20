import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import NewChatPage from "./page";

// #151: /chats/new hatte als einzige App-Seite keine h1, die einzige Überschrift war die h2 "Woran arbeiten
// wir, …?" im leeren Chat. Die Seite trägt jetzt eine für Screenreader sichtbare h1, die Begrüßung bleibt h2.
vi.mock("next/navigation", () => ({ redirect: vi.fn() }));
vi.mock("@/server/i18n", async () => {
  const { de } = await import("@/shared/i18n/messages/de");
  return { getT: async () => de };
});
const client = {
  from: () => ({
    select: () => ({ eq: () => ({ order: () => ({ limit: async () => ({ data: [], error: null }) }) }) }),
  }),
};
vi.mock("@/server/supabase/server", () => ({ createClient: async () => client }));
vi.mock("@/server/session", () => ({
  getSessionUser: async () => ({ id: "user-1", email: "anna@example.test" }),
  getSessionProfile: async () => ({ display_name: "Anna" }),
  getNeedsOwnKey: async () => false,
  getFreePromptsLeft: async () => null,
}));
const loadStartPrompt = vi.fn();
vi.mock("@/server/start-from-prompt", () => ({ loadStartPrompt: (...a: unknown[]) => loadStartPrompt(...a) }));
vi.mock("@/shared/motion/fade-in", () => ({
  FadeIn: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));
vi.mock("@/features/chat/components/chat", () => ({
  Chat: ({ name, initialInput }: { name: string | null; initialInput?: string }) => (
    <h2 data-initial-input={initialInput ?? ""}>Woran arbeiten wir, {name}?</h2>
  ),
}));

const ID = "6f1c2d3e-4b5a-4c7d-8e9f-0a1b2c3d4e5f";
const page = (from?: string) => NewChatPage({ searchParams: Promise.resolve(from ? { from } : {}) });

describe("NewChatPage", () => {
  beforeEach(() => {
    loadStartPrompt.mockReset();
    loadStartPrompt.mockResolvedValue(null);
  });

  it("trägt genau eine h1 und lässt die Begrüßung im Chat darunter eine h2 bleiben", async () => {
    render(await page());
    const h1s = screen.getAllByRole("heading", { level: 1 });
    expect(h1s).toHaveLength(1);
    expect(h1s[0]).toHaveTextContent("Neuer Chat");
    expect(h1s[0]).toHaveClass("sr-only");
    expect(screen.getByRole("heading", { level: 2 })).toHaveTextContent("Woran arbeiten wir, Anna?");
  });

  it("legt mit ?from= den eigenen gespeicherten Prompt ins Eingabefeld, mit der Zeile für die Änderung", async () => {
    loadStartPrompt.mockResolvedValue("Schreib eine Einladung.");
    render(await page(ID));
    expect(loadStartPrompt).toHaveBeenCalledWith(client, "user-1", ID);
    expect(screen.getByRole("heading", { level: 2 })).toHaveAttribute(
      "data-initial-input",
      "Pass diesen Prompt an: \n\nSchreib eine Einladung."
    );
  });

  it("startet leer, wenn es den Prompt für dieses Konto nicht gibt", async () => {
    render(await page(ID));
    expect(screen.getByRole("heading", { level: 2 })).toHaveAttribute("data-initial-input", "");
  });
});
