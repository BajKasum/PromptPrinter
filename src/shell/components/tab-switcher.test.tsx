import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { TabSwitcher as ReExported } from "./sidebar";
import { TabSwitcher } from "./tab-switcher";

// Der Pillen-Umschalter liegt seit der Zerlegung von sidebar.tsx (Betriebs-Audit, Folgesitzung 2026-10-07,
// Dateigröße) in tab-switcher.tsx. Das mobile Menü und die Landing-Vorschau importieren ihn weiter aus
// sidebar.tsx. Das Verhalten prüft sidebar.behavior.test.tsx über genau diese Fläche.

describe("tab-switcher.tsx", () => {
  it("sidebar.tsx führt denselben Umschalter weiter (kein zweiter Satz, kein abweichendes Verhalten)", () => {
    expect(ReExported).toBe(TabSwitcher);
  });

  it("rendert direkt aus der eigenen Datei: zwei Links, Chat zuerst, die aktive Pille trägt aria-current", () => {
    render(<TabSwitcher tab="projects" />);
    const [chat, project] = screen.getAllByRole("link");
    expect(chat).toHaveAttribute("href", "/chats");
    expect(project).toHaveAttribute("href", "/projects");
    expect(project).toHaveAttribute("aria-current", "page");
    expect(chat).not.toHaveAttribute("aria-current");
  });
});
