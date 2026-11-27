import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ACTIVE_ROW, ChatNavList, INACTIVE_ROW, ProjectNavList, navTab } from "./nav-lists";

// #369: die Zeilenregeln für Sidebar und Mobile-Drawer.

const chats = [
  { id: "c1", title: "Erste Idee" },
  { id: "c2", title: "Zweite Idee" },
];
const projects = [
  { id: "p1", name: "Alpha", isFavorite: true },
  { id: "p2", name: "Beta", isFavorite: false },
];

const link = (name: RegExp) => screen.getByRole("link", { name });
const ROW = "py-[9px] text-[14px]";

describe("navTab", () => {
  it.each([
    ["/projects", "projects"],
    ["/projects/p1/results", "projects"],
    ["/projectsx", "chats"],
    ["/chats/c1", "chats"],
    ["/settings", "chats"],
  ] as const)("%s zeigt %s", (pathname, tab) => {
    expect(navTab(pathname)).toBe(tab);
  });
});

describe("ChatNavList", () => {
  it("verlinkt jeden Chat und markiert genau den der Adresse", () => {
    render(<ChatNavList items={chats} pathname="/chats/c2" rowClassName={ROW} />);

    expect(link(/Erste/)).toHaveAttribute("href", "/chats/c1");
    expect(link(/Erste/)).toHaveAttribute("title", "Erste Idee");
    expect(link(/Erste/)).not.toHaveAttribute("aria-current");
    expect(link(/Zweite/)).toHaveAttribute("aria-current", "page");
    expect(link(/Zweite/).className).toContain("bg-accent-subtle");
    expect(link(/Erste/).className).toContain("hover:bg-surface-hover");
    // Grösse von der Ansicht, Einzug aus der Liste.
    for (const row of screen.getAllByRole("link")) {
      for (const token of ["py-[9px]", "text-[14px]", "pl-3.5", "truncate"]) expect(row.className).toContain(token);
    }
  });

  it("markiert keinen Namensvetter und keinen Projekt-Chat", () => {
    for (const pathname of ["/chats/c10", "/projects/p1/chats/c1"]) {
      const view = render(<ChatNavList items={chats} pathname={pathname} rowClassName={ROW} />);
      expect(link(/Erste/), pathname).not.toHaveAttribute("aria-current");
      view.unmount();
    }
  });

  it("zeigt ohne Chats den Hinweis", () => {
    render(<ChatNavList items={[]} pathname="/chats" rowClassName={ROW} />);
    expect(screen.getByText("Dein erster Chat landet hier.")).toBeInTheDocument();
  });

  it("meldet das Antippen einer Zeile", async () => {
    const onNavigate = vi.fn();
    render(<ChatNavList items={chats} pathname="/chats" rowClassName={ROW} onNavigate={onNavigate} />);
    await userEvent.setup().click(link(/Erste/));
    expect(onNavigate).toHaveBeenCalledTimes(1);
  });
});

describe("ProjectNavList", () => {
  it("markiert das Projekt samt Unterseiten, aber keinen Namensvetter", () => {
    for (const [pathname, active] of [
      ["/projects/p1", true],
      ["/projects/p1/chats/c1", true],
      ["/projects/p1x", false],
      ["/projects", false],
    ] as const) {
      const view = render(<ProjectNavList items={projects} pathname={pathname} rowClassName={ROW} />);
      if (active) expect(link(/Alpha/), pathname).toHaveAttribute("aria-current", "page");
      else expect(link(/Alpha/), pathname).not.toHaveAttribute("aria-current");
      expect(link(/Beta/)).not.toHaveAttribute("aria-current");
      view.unmount();
    }
  });

  it("trägt Ziel, Titel, Grösse und den Stern nur beim angepinnten", () => {
    render(<ProjectNavList items={projects} pathname="/projects" rowClassName={ROW} />);
    expect(link(/Alpha/)).toHaveAttribute("href", "/projects/p1");
    expect(link(/Alpha/)).toHaveAttribute("title", "Alpha");
    expect(link(/Alpha/).className).toContain("text-[14px]");
    expect(screen.getAllByLabelText("Angepinnt")).toHaveLength(1);
    expect(link(/Alpha/)).toContainElement(screen.getByLabelText("Angepinnt"));
  });

  it("zeigt ohne Projekte den Hinweis und meldet das Antippen", async () => {
    const empty = render(<ProjectNavList items={[]} pathname="/projects" rowClassName={ROW} />);
    expect(screen.getByText("Noch kein Projekt angelegt.")).toBeInTheDocument();
    empty.unmount();

    const onNavigate = vi.fn();
    render(<ProjectNavList items={projects} pathname="/projects" rowClassName={ROW} onNavigate={onNavigate} />);
    await userEvent.setup().click(link(/Beta/));
    expect(onNavigate).toHaveBeenCalledTimes(1);
  });
});

describe("Zeilenstil", () => {
  it("aktiv trägt Tönung und Akzentstrich, sonst gilt der Hover", () => {
    expect(ACTIVE_ROW).toContain("before:w-[3px]");
    expect(INACTIVE_ROW).toContain("hover:bg-surface-hover");
  });
});
