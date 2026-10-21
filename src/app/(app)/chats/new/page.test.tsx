import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import NewChatPage from "./page";

// #151: /chats/new hatte als einzige App-Seite keine h1, die einzige Überschrift war die h2 "Woran arbeiten
// wir, …?" im leeren Chat. Die Seite trägt jetzt eine für Screenreader sichtbare h1, die Begrüßung bleibt h2.
vi.mock("next/navigation", () => ({ redirect: vi.fn() }));
vi.mock("@/server/i18n", async () => {
  const { de } = await import("@/shared/i18n/messages/de");
  return { getT: async () => de };
});
vi.mock("@/server/supabase/server", () => ({
  createClient: async () => ({
    from: () => ({
      select: () => ({ eq: () => ({ order: () => ({ limit: async () => ({ data: [] }) }) }) }),
    }),
  }),
}));
vi.mock("@/server/session", () => ({
  getSessionUser: async () => ({ id: "user-1", email: "anna@example.test" }),
  getSessionProfile: async () => ({ display_name: "Anna" }),
  getNeedsOwnKey: async () => false,
}));
vi.mock("@/shared/motion/fade-in", () => ({
  FadeIn: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));
vi.mock("@/features/chat/components/chat", () => ({
  Chat: ({ name }: { name: string | null }) => <h2>Woran arbeiten wir, {name}?</h2>,
}));

describe("NewChatPage", () => {
  it("trägt genau eine h1 und lässt die Begrüßung im Chat darunter eine h2 bleiben", async () => {
    render(await NewChatPage());
    const h1s = screen.getAllByRole("heading", { level: 1 });
    expect(h1s).toHaveLength(1);
    expect(h1s[0]).toHaveTextContent("Neuer Chat");
    expect(h1s[0]).toHaveClass("sr-only");
    expect(screen.getByRole("heading", { level: 2 })).toHaveTextContent("Woran arbeiten wir, Anna?");
  });
});
