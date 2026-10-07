import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { Rail } from "./sidebar-rail";

// Die Leiste mit den Symbolen liegt seit der Zerlegung von sidebar.tsx (Betriebs-Audit, Folgesitzung 2026-10-07,
// Dateigröße) in sidebar-rail.tsx. Das Verhalten im Zusammenspiel mit der Seitenleiste prüft
// sidebar.behavior.test.tsx; hier steht, dass sie auch allein trägt.

vi.mock("@/shell/components/account-menu", () => ({
  AccountMenu: (p: { collapsed: boolean; email: string }) => (
    <div data-testid="account-menu" data-collapsed={String(p.collapsed)} data-email={p.email} />
  ),
}));

const account = { email: "anna@example.test", plan: "pro", isAdmin: false, displayName: "Anna" };

describe("Rail", () => {
  it("zeigt Neuer Chat, die beiden Ziele und das eingeklappte Konto", () => {
    render(<Rail pathname="/projects/p1" {...account} />);
    expect(screen.getByRole("link", { name: "Neuer Chat" })).toHaveAttribute("href", "/chats/new");
    expect(screen.getByRole("link", { name: "Chats" })).not.toHaveAttribute("aria-current");
    expect(screen.getByRole("link", { name: "Projekte" })).toHaveAttribute("aria-current", "page");
    expect(screen.getByTestId("account-menu")).toHaveAttribute("data-collapsed", "true");
    expect(screen.getByTestId("account-menu")).toHaveAttribute("data-email", "anna@example.test");
  });
});
