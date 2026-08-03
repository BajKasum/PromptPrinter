import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import {
  Sidebar,
  TabSwitcher,
  SIDEBAR_COOKIE,
  SIDEBAR_WIDTH_COOKIE,
  DEFAULT_SIDEBAR_WIDTH,
} from "./sidebar";

let pathname = "/chats";
const push = vi.fn();
const refresh = vi.fn();

vi.mock("next/navigation", () => ({
  usePathname: () => pathname,
  useRouter: () => ({ push, refresh }),
}));

vi.mock("@/features/projects/components/new-project", () => ({
  NewProjectButton: () => <div data-testid="new-project-button" />,
}));

function clearCookies() {
  document.cookie = `${SIDEBAR_COOKIE}=; path=/; max-age=0`;
  document.cookie = `${SIDEBAR_WIDTH_COOKIE}=; path=/; max-age=0`;
}

const chats = [
  { id: "c1", title: "Erste Idee" },
  { id: "c2", title: "Zweite Idee" },
];
const projects = [
  { id: "p1", name: "Alpha", isFavorite: true },
  { id: "p2", name: "Beta", isFavorite: false },
];

describe("Sidebar (expanded)", () => {
  beforeEach(() => {
    pathname = "/chats";
    clearCookies();
  });

  it("shows the chat list and an empty hint for projects when on /chats", () => {
    render(
      <Sidebar
        initialCollapsed={false}
        initialWidth={DEFAULT_SIDEBAR_WIDTH}
        chats={chats}
        projects={[]}
      />
    );
    expect(screen.getByText("Erste Idee")).toBeInTheDocument();
    expect(screen.getByText("Zweite Idee")).toBeInTheDocument();
  });

  it("shows an empty hint when there are no chats yet", () => {
    render(
      <Sidebar
        initialCollapsed={false}
        initialWidth={DEFAULT_SIDEBAR_WIDTH}
        chats={[]}
        projects={[]}
      />
    );
    expect(screen.getByText("Dein erster Chat landet hier.")).toBeInTheDocument();
  });

  it("marks the current chat as the active row", () => {
    pathname = "/chats/c2";
    render(
      <Sidebar
        initialCollapsed={false}
        initialWidth={DEFAULT_SIDEBAR_WIDTH}
        chats={chats}
        projects={[]}
      />
    );
    expect(screen.getByText("Zweite Idee").closest("a")).toHaveAttribute(
      "aria-current",
      "page"
    );
    expect(screen.getByText("Erste Idee").closest("a")).not.toHaveAttribute("aria-current");
  });

  it("switches to the projects list on a /projects pathname, including favorites", () => {
    pathname = "/projects/p1";
    render(
      <Sidebar
        initialCollapsed={false}
        initialWidth={DEFAULT_SIDEBAR_WIDTH}
        chats={chats}
        projects={projects}
      />
    );
    expect(screen.getByText("Alpha").closest("a")).toHaveAttribute("aria-current", "page");
    expect(screen.getByLabelText("Angepinnt")).toBeInTheDocument();
    expect(screen.queryByText("Erste Idee")).not.toBeInTheDocument();
  });

  it("shows an empty hint when there are no projects yet", () => {
    pathname = "/projects";
    render(
      <Sidebar
        initialCollapsed={false}
        initialWidth={DEFAULT_SIDEBAR_WIDTH}
        chats={chats}
        projects={[]}
      />
    );
    expect(screen.getByText("Noch kein Projekt angelegt.")).toBeInTheDocument();
  });

  it("collapses on click and persists the cookie", async () => {
    const user = userEvent.setup();
    render(
      <Sidebar
        initialCollapsed={false}
        initialWidth={DEFAULT_SIDEBAR_WIDTH}
        chats={chats}
        projects={[]}
      />
    );
    await user.click(screen.getByRole("button", { name: "Seitenleiste einklappen" }));

    expect(screen.getByRole("button", { name: "Seitenleiste ausklappen" })).toBeInTheDocument();
    expect(document.cookie).toContain(`${SIDEBAR_COOKIE}=1`);
    expect(screen.queryByText("Erste Idee")).not.toBeInTheDocument();
  });

  it("toggles collapse on Ctrl+B", async () => {
    const user = userEvent.setup();
    render(
      <Sidebar
        initialCollapsed={false}
        initialWidth={DEFAULT_SIDEBAR_WIDTH}
        chats={chats}
        projects={[]}
      />
    );
    await user.keyboard("{Control>}b{/Control}");
    expect(screen.getByRole("button", { name: "Seitenleiste ausklappen" })).toBeInTheDocument();
    expect(document.cookie).toContain(`${SIDEBAR_COOKIE}=1`);
  });

  it("resizes with the keyboard on the drag handle and persists the width cookie", async () => {
    const user = userEvent.setup();
    render(
      <Sidebar
        initialCollapsed={false}
        initialWidth={DEFAULT_SIDEBAR_WIDTH}
        chats={chats}
        projects={[]}
      />
    );
    const handle = screen.getByRole("separator", { name: "Seitenleisten-Breite" });
    handle.focus();
    await user.keyboard("{ArrowRight}");

    expect(handle).toHaveAttribute("aria-valuenow", String(DEFAULT_SIDEBAR_WIDTH + 16));
    expect(document.cookie).toContain(
      `${SIDEBAR_WIDTH_COOKIE}=${DEFAULT_SIDEBAR_WIDTH + 16}`
    );
  });

  it("clamps keyboard resize to the minimum width", async () => {
    const user = userEvent.setup();
    render(
      <Sidebar
        initialCollapsed={false}
        initialWidth={230}
        chats={chats}
        projects={[]}
      />
    );
    const handle = screen.getByRole("separator", { name: "Seitenleisten-Breite" });
    handle.focus();
    await user.keyboard("{ArrowLeft}{ArrowLeft}");
    expect(handle).toHaveAttribute("aria-valuenow", "220");
  });
});

describe("Sidebar (collapsed)", () => {
  beforeEach(() => {
    pathname = "/chats";
    clearCookies();
  });

  it("shows an icon rail without chat titles or the drag handle", () => {
    render(
      <Sidebar
        initialCollapsed
        initialWidth={DEFAULT_SIDEBAR_WIDTH}
        chats={chats}
        projects={[]}
      />
    );
    expect(screen.queryByText("Erste Idee")).not.toBeInTheDocument();
    expect(screen.queryByRole("separator")).not.toBeInTheDocument();
    expect(screen.getByLabelText("Chats")).toBeInTheDocument();
    expect(screen.getByLabelText("Projekte")).toBeInTheDocument();
  });
});

describe("TabSwitcher", () => {
  it("marks the chats pill active on the chats tab", () => {
    render(<TabSwitcher tab="chats" />);
    expect(screen.getByText("Chat").closest("a")).toHaveAttribute("aria-current", "page");
    expect(screen.getByText("Projekt").closest("a")).not.toHaveAttribute("aria-current");
  });

  it("marks the projects pill active on the projects tab", () => {
    render(<TabSwitcher tab="projects" />);
    expect(screen.getByText("Projekt").closest("a")).toHaveAttribute("aria-current", "page");
  });
});
