import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MobileNav } from "./mobile-nav";

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

const chats = [
  { id: "c1", title: "Erste Idee" },
  { id: "c2", title: "Zweite Idee" },
];
const projects = [{ id: "p1", name: "Alpha", isFavorite: true }];

// jsdom kennt matchMedia nicht. Diese Attrappe wertet `(min-width: Npx)` gegen eine steuerbare Fensterbreite aus
// und meldet wie der Browser nur, wenn sich das Ergebnis einer Abfrage ändert.
let width = 390;
const watchers = new Set<() => void>();

function fakeMatchMedia(query: string) {
  const min = Number(/\(min-width: (\d+)px\)/.exec(query)?.[1]);
  const matches = () => width >= min;
  const own = new Map<(e: MediaQueryListEvent) => void, () => void>();
  return {
    media: query,
    get matches() {
      return matches();
    },
    addEventListener: (_type: "change", listener: (e: MediaQueryListEvent) => void) => {
      let last = matches();
      const watch = () => {
        if (matches() === last) return;
        last = matches();
        listener({ matches: last, media: query } as MediaQueryListEvent);
      };
      own.set(listener, watch);
      watchers.add(watch);
    },
    removeEventListener: (_type: "change", listener: (e: MediaQueryListEvent) => void) => {
      const watch = own.get(listener);
      if (watch) watchers.delete(watch);
    },
  };
}

function resizeTo(next: number) {
  act(() => {
    width = next;
    watchers.forEach((watch) => watch());
  });
}

describe("MobileNav", () => {
  beforeEach(() => {
    pathname = "/chats";
    document.body.style.overflow = "";
    width = 390;
    watchers.clear();
    vi.stubGlobal("matchMedia", fakeMatchMedia);
  });

  afterEach(() => vi.unstubAllGlobals());

  it("is closed by default", () => {
    render(<MobileNav chats={chats} projects={[]} />);
    expect(screen.queryByText("Erste Idee")).not.toBeInTheDocument();
  });

  it("opens the drawer, shows the chat list, and locks body scroll", async () => {
    const user = userEvent.setup();
    render(<MobileNav chats={chats} projects={[]} />);
    await user.click(screen.getByRole("button", { name: "Menü öffnen" }));

    expect(screen.getByText("Erste Idee")).toBeInTheDocument();
    expect(document.body.style.overflow).toBe("hidden");
  });

  it("hängt den Drawer an document.body, nicht in die Kopfleiste mit backdrop-filter", async () => {
    // Ein Vorfahre mit backdrop-filter wird zum Bezugsrahmen für `fixed inset-0`:
    // der Drawer war so nur 56 px hoch (Handy-Audit 2026-10-17).
    const user = userEvent.setup();
    const { container } = render(<MobileNav chats={chats} projects={[]} />);
    await user.click(screen.getByRole("button", { name: "Menü öffnen" }));

    const drawer = screen.getByText("Erste Idee").closest("aside");
    expect(drawer).not.toBeNull();
    expect(container.contains(drawer)).toBe(false);
    expect(drawer?.parentElement?.parentElement).toBe(document.body);
  });

  it("lists the account destinations and a collapsible 'Mehr erfahren'", async () => {
    const user = userEvent.setup();
    render(<MobileNav chats={chats} projects={[]} />);
    await user.click(screen.getByRole("button", { name: "Menü öffnen" }));

    expect(screen.getByRole("link", { name: "Nutzung" })).toHaveAttribute("href", "/usage");
    expect(screen.getByRole("link", { name: "Gespeicherte Prompts" })).toHaveAttribute("href", "/prompts");
    // Abrechnung und Tarife gibt es nicht: PromptPrinter kostet nichts.
    const hrefs = Array.from(document.querySelectorAll("a")).map((a) => a.getAttribute("href"));
    expect(hrefs).not.toContain("/billing");
    expect(hrefs).not.toContain("/plans");
    const more = screen.getByRole("button", { name: "Mehr erfahren" });
    expect(more).toHaveAttribute("aria-expanded", "false");
    await user.click(more);
    expect(more).toHaveAttribute("aria-expanded", "true");
    expect(screen.getByRole("link", { name: /Nutzungsrichtlinie/ })).toHaveAttribute(
      "href",
      "/nutzungsrichtlinie"
    );
  });

  it("closes on Escape and restores body scroll", async () => {
    const user = userEvent.setup();
    render(<MobileNav chats={chats} projects={[]} />);
    await user.click(screen.getByRole("button", { name: "Menü öffnen" }));
    await user.keyboard("{Escape}");

    await waitFor(() => expect(screen.queryByText("Erste Idee")).not.toBeInTheDocument());
    expect(document.body.style.overflow).toBe("");
  });

  it("schliesst den Drawer ab 768 px und gibt das Scrollen wieder frei", async () => {
    const user = userEvent.setup();
    render(<MobileNav chats={chats} projects={[]} />);
    await user.click(screen.getByRole("button", { name: "Menü öffnen" }));

    resizeTo(767);
    expect(screen.getByRole("button", { name: "Menü öffnen" })).toHaveAttribute("aria-expanded", "true");
    expect(document.body.style.overflow).toBe("hidden");

    resizeTo(768);
    expect(screen.getByRole("button", { name: "Menü öffnen" })).toHaveAttribute("aria-expanded", "false");
    expect(document.body.style.overflow).toBe("");
    await waitFor(() => expect(screen.queryByText("Erste Idee")).not.toBeInTheDocument());
    // Zu heisst auch: niemand beobachtet die Breite weiter.
    expect(watchers.size).toBe(0);
  });

  it("closes when the backdrop is clicked", async () => {
    // Both the backdrop and the X button share the "Menü schliessen" label,
    // the backdrop is the first one in DOM order.
    const user = userEvent.setup();
    render(<MobileNav chats={chats} projects={[]} />);
    await user.click(screen.getByRole("button", { name: "Menü öffnen" }));
    const [backdrop] = screen.getAllByRole("button", { name: "Menü schliessen" });
    await user.click(backdrop);

    // AnimatePresence keeps the drawer mounted through its exit transition.
    await waitFor(() => expect(screen.queryByText("Erste Idee")).not.toBeInTheDocument());
  });

  it("closes when a chat link is tapped", async () => {
    const user = userEvent.setup();
    render(<MobileNav chats={chats} projects={[]} />);
    await user.click(screen.getByRole("button", { name: "Menü öffnen" }));
    await user.click(screen.getByText("Erste Idee"));

    await waitFor(() => expect(screen.queryByText("Erste Idee")).not.toBeInTheDocument());
  });

  it("closes automatically when the route changes", async () => {
    const user = userEvent.setup();
    const { rerender } = render(<MobileNav chats={chats} projects={[]} />);
    await user.click(screen.getByRole("button", { name: "Menü öffnen" }));
    expect(screen.getByText("Erste Idee")).toBeInTheDocument();

    pathname = "/chats/c1";
    rerender(<MobileNav chats={chats} projects={[]} />);

    await waitFor(() => expect(screen.queryByText("Erste Idee")).not.toBeInTheDocument());
  });

  it("marks the active chat and shows the empty hint when there are none", async () => {
    pathname = "/chats/c2";
    const user = userEvent.setup();
    render(<MobileNav chats={chats} projects={[]} />);
    await user.click(screen.getByRole("button", { name: "Menü öffnen" }));

    expect(screen.getByText("Zweite Idee").closest("a")).toHaveAttribute(
      "aria-current",
      "page"
    );
  });

  it("shows the projects list with favorites when on a /projects route", async () => {
    pathname = "/projects/p1";
    const user = userEvent.setup();
    render(<MobileNav chats={chats} projects={projects} />);
    await user.click(screen.getByRole("button", { name: "Menü öffnen" }));

    expect(screen.getByText("Alpha").closest("a")).toHaveAttribute("aria-current", "page");
    expect(screen.getByLabelText("Angepinnt")).toBeInTheDocument();
    expect(screen.queryByText("Erste Idee")).not.toBeInTheDocument();
  });

  it("shows the empty-projects hint", async () => {
    pathname = "/projects";
    const user = userEvent.setup();
    render(<MobileNav chats={chats} projects={[]} />);
    await user.click(screen.getByRole("button", { name: "Menü öffnen" }));

    expect(screen.getByText("Noch kein Projekt angelegt.")).toBeInTheDocument();
  });
});
