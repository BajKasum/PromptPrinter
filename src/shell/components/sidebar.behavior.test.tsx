import { act, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  ACTIVE_ROW,
  DEFAULT_SIDEBAR_WIDTH,
  INACTIVE_ROW,
  MAX_SIDEBAR_WIDTH,
  MIN_SIDEBAR_WIDTH,
  SIDEBAR_COOKIE,
  SIDEBAR_WIDTH_COOKIE,
  Sidebar,
  TabSwitcher,
} from "./sidebar";

// Charakterisierungstests (Betriebs-Audit, Folgesitzung 2026-10-07, Teil E): halten die Seitenleiste fest, BEVOR
// sidebar.tsx unter die 400-Zeilen-Grenze zerlegt wird (Rail und TabSwitcher in eigene Dateien). Sie rufen nur
// die öffentliche Fläche (Sidebar, TabSwitcher, ACTIVE_ROW) und müssen vor und nach dem Schnitt unverändert
// laufen. Ergänzen sidebar.test.tsx: Breite, Tastenkürzel, Trenner, Rail, Pillen, aktive Zeilen.
//
// Kontomenü, Befehlspalette und Neues-Projekt-Knopf haben eigene Tests und sind hier Attrappen, die ihre
// Eigenschaften offenlegen.

let pathname = "/chats";
vi.mock("next/navigation", () => ({
  usePathname: () => pathname,
  useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }),
}));
vi.mock("@/features/projects/components/new-project", () => ({
  NewProjectButton: ({ variant }: { variant?: string }) => <div data-testid="new-project-button" data-variant={variant} />,
}));
vi.mock("@/shell/components/account-menu", () => ({
  AccountMenu: (p: { collapsed: boolean; email: string; plan: string; isAdmin: boolean; displayName?: string | null }) => (
    <div
      data-testid="account-menu"
      data-collapsed={String(p.collapsed)}
      data-email={p.email}
      data-plan={p.plan}
      data-admin={String(p.isAdmin)}
      data-name={p.displayName ?? ""}
    />
  ),
}));
vi.mock("@/shell/components/command-palette", () => ({
  CommandPalette: ({ open, onClose }: { open: boolean; onClose: () => void }) =>
    open ? (
      <div role="dialog" aria-label="Befehlspalette">
        <button onClick={onClose}>schliessen</button>
      </div>
    ) : null,
}));
vi.mock("@/shell/hooks/use-nav-shortcuts", () => ({ useNavShortcuts: () => {} }));

const chats = [
  { id: "c1", title: "Erste Idee" },
  { id: "c2", title: "Zweite Idee" },
];
const projects = [
  { id: "p1", name: "Alpha", isFavorite: true },
  { id: "p2", name: "Beta", isFavorite: false },
];

function renderSidebar(props: Partial<Parameters<typeof Sidebar>[0]> = {}) {
  return render(
    <Sidebar
      initialCollapsed={false}
      initialWidth={DEFAULT_SIDEBAR_WIDTH}
      chats={chats}
      projects={projects}
      email="anna@example.test"
      plan="pro"
      isAdmin
      displayName="Anna"
      {...props}
    />
  );
}

const aside = (container: HTMLElement) => container.querySelector("aside") as HTMLElement;
const handle = () => screen.getByRole("separator");
const link = (name: string | RegExp) => screen.getByRole("link", { name });

beforeEach(() => {
  pathname = "/chats";
  document.cookie = `${SIDEBAR_COOKIE}=; path=/; max-age=0`;
  document.cookie = `${SIDEBAR_WIDTH_COOKIE}=; path=/; max-age=0`;
  document.documentElement.style.removeProperty("--sidebar-w");
  // jsdom kennt kein Pointer-Capture
  HTMLElement.prototype.setPointerCapture = vi.fn();
  HTMLElement.prototype.releasePointerCapture = vi.fn();
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("Breite", () => {
  it("die Leiste ist so breit wie gespeichert (ausgeklappt) und 68 px schmal (eingeklappt)", () => {
    const expanded = renderSidebar({ initialWidth: 300 });
    expect(aside(expanded.container).style.width).toBe("300px");
    expanded.unmount();

    const collapsed = renderSidebar({ initialCollapsed: true, initialWidth: 300 });
    expect(aside(collapsed.container).style.width).toBe("68px");
  });

  it("stellt die aktuelle Breite als --sidebar-w bereit (die Speicherleiste der Einstellungen liest sie) und führt sie beim Umschalten nach", () => {
    const { container } = renderSidebar({ initialWidth: 300 });
    expect(document.documentElement.style.getPropertyValue("--sidebar-w")).toBe("300px");

    fireEvent.click(screen.getByRole("button", { name: "Seitenleiste einklappen" }));
    expect(aside(container).style.width).toBe("68px");
    expect(document.documentElement.style.getPropertyValue("--sidebar-w")).toBe("68px");

    fireEvent.click(screen.getByRole("button", { name: "Seitenleiste ausklappen" }));
    expect(document.documentElement.style.getPropertyValue("--sidebar-w")).toBe("300px");
  });

  it("klemmt eine gespeicherte Breite in die Grenzen", () => {
    const { container } = renderSidebar({ initialWidth: 9999 });
    expect(aside(container).style.width).toBe(`${MAX_SIDEBAR_WIDTH}px`);
  });
});

describe("Kopf", () => {
  it("das Logo führt zu den Chats und trägt eine Beschriftung", () => {
    renderSidebar();
    const home = link("PromptPrinter, zu deinen Chats");
    expect(home).toHaveAttribute("href", "/chats");
  });

  it("eingeklappt zeigt der Kopf nur das Zeichen (kein Schriftzug), ausgeklappt den Schriftzug", () => {
    const expanded = renderSidebar();
    expect(screen.getByRole("link", { name: "PromptPrinter, zu deinen Chats" }).textContent).toContain("Prompt");
    expanded.unmount();

    renderSidebar({ initialCollapsed: true });
    expect(screen.getByRole("link", { name: "PromptPrinter, zu deinen Chats" }).textContent ?? "").not.toContain("Printer");
  });

  it("der Umschalter nennt Tastenkürzel (aria und Titel), das Symbol wechselt mit dem Zustand", () => {
    const { container } = renderSidebar();
    const toggle = screen.getByRole("button", { name: "Seitenleiste einklappen" });
    expect(toggle).toHaveAttribute("aria-keyshortcuts", "Control+B Meta+B");
    expect(toggle.getAttribute("title")).toBe("Seitenleiste ein-/ausklappen (Strg/⌘ B)");
    expect(toggle.querySelector("svg")?.getAttribute("class") ?? "").toContain("h-4 w-4");
    expect(toggle.querySelector("svg")?.getAttribute("class")).toContain("lucide-panel-left-close");

    fireEvent.click(toggle);
    const open = screen.getByRole("button", { name: "Seitenleiste ausklappen" });
    expect(open.querySelector("svg")?.getAttribute("class")).toContain("lucide-panel-left-open");
    expect(aside(container).style.width).toBe("68px");
  });
});

describe("Befehlspalette (Strg/⌘ + K)", () => {
  it("öffnet sich mit Strg+K und unterdrückt die Standardaktion des Browsers", () => {
    renderSidebar();
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();

    let proceeded = true;
    act(() => {
      proceeded = fireEvent.keyDown(window, { key: "k", ctrlKey: true });
    });
    expect(proceeded).toBe(false); // preventDefault wurde gerufen
    expect(screen.getByRole("dialog")).toBeInTheDocument();
  });

  it("öffnet sich auch mit ⌘+K", () => {
    renderSidebar();
    act(() => {
      fireEvent.keyDown(window, { key: "k", metaKey: true });
    });
    expect(screen.getByRole("dialog")).toBeInTheDocument();
  });

  it("ignoriert andere Tasten, ein K ohne Strg und Strg+Shift+K", () => {
    renderSidebar();
    for (const init of [
      { key: "j", ctrlKey: true },
      { key: "k" },
      { key: "k", ctrlKey: true, shiftKey: true },
    ]) {
      let proceeded = true;
      act(() => {
        proceeded = fireEvent.keyDown(window, init);
      });
      expect(proceeded, JSON.stringify(init)).toBe(true);
    }
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("schliesst sich wieder, wenn die Palette um Schliessen bittet", () => {
    renderSidebar();
    act(() => {
      fireEvent.keyDown(window, { key: "k", ctrlKey: true });
    });
    fireEvent.click(screen.getByRole("button", { name: "schliessen" }));
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("gibt seinen Tastatur-Lauscher beim Abbau wieder frei", () => {
    const add = vi.spyOn(window, "addEventListener");
    const remove = vi.spyOn(window, "removeEventListener");
    const { unmount } = renderSidebar();
    unmount();
    const count = (spy: typeof add) => spy.mock.calls.filter(([type]) => type === "keydown").length;
    expect(count(remove)).toBe(count(add));
    expect(count(add)).toBeGreaterThan(0);
  });
});

describe("Trenner zum Ziehen", () => {
  it("ist ein fokussierbarer, beschrifteter Schieber mit Wert und Grenzen", () => {
    renderSidebar({ initialWidth: 300.4 });
    const separator = handle();
    expect(separator).toHaveAttribute("aria-label", "Seitenleisten-Breite");
    expect(separator).toHaveAttribute("aria-orientation", "vertical");
    expect(separator).toHaveAttribute("aria-valuenow", "300"); // gerundet
    expect(separator).toHaveAttribute("aria-valuemin", String(MIN_SIDEBAR_WIDTH));
    expect(separator).toHaveAttribute("aria-valuemax", String(MAX_SIDEBAR_WIDTH));
    expect(separator).toHaveAttribute("tabindex", "0");
  });

  it("gibt es nur ausgeklappt", () => {
    renderSidebar({ initialCollapsed: true });
    expect(screen.queryByRole("separator")).not.toBeInTheDocument();
  });

  it("Ziehen: ohne Übergang und mit Akzentlinie, Loslassen und Abbrechen beenden es und schreiben den Cookie", () => {
    const { container } = renderSidebar();
    const transition = "transition-[width]";
    expect(aside(container).className).toContain(transition);

    fireEvent.pointerDown(handle(), { clientX: 264, pointerId: 1 });
    expect(aside(container).className).not.toContain(transition);
    expect(handle().querySelector("span")?.className).toContain("!bg-accent");

    fireEvent.pointerMove(handle(), { clientX: 300, pointerId: 1 });
    expect(Number(handle().getAttribute("aria-valuenow"))).toBeGreaterThan(DEFAULT_SIDEBAR_WIDTH);

    fireEvent.pointerUp(handle(), { clientX: 300, pointerId: 1 });
    expect(aside(container).className).toContain(transition);
    expect(document.cookie).toContain(SIDEBAR_WIDTH_COOKIE);

    fireEvent.pointerDown(handle(), { clientX: 300, pointerId: 1 });
    expect(aside(container).className).not.toContain(transition);
    fireEvent.pointerCancel(handle(), { pointerId: 1 });
    expect(aside(container).className).toContain(transition);
  });

  it("die Pfeiltasten verstellen die Breite (Tastatur-Zugang)", () => {
    renderSidebar();
    const before = Number(handle().getAttribute("aria-valuenow"));
    fireEvent.keyDown(handle(), { key: "ArrowRight" });
    expect(Number(handle().getAttribute("aria-valuenow"))).toBeGreaterThan(before);
  });
});

describe("Ausgeklappt: Chats und Projekte", () => {
  it("auf einer Chat-Seite: Neuer Chat, die Chats als Links (Titel, Ziel), nur der aktuelle ist markiert", () => {
    pathname = "/chats/c2";
    renderSidebar();
    expect(link("Neuer Chat")).toHaveAttribute("href", "/chats/new");

    const first = link("Erste Idee");
    expect(first).toHaveAttribute("href", "/chats/c1");
    expect(first).toHaveAttribute("title", "Erste Idee");
    expect(first).not.toHaveAttribute("aria-current");
    expect(first.className).toContain("hover:bg-surface-hover");

    const second = link("Zweite Idee");
    expect(second).toHaveAttribute("aria-current", "page");
    for (const token of ACTIVE_ROW.split(" ").slice(0, 3)) expect(second.className).toContain(token);
    expect(screen.queryByTestId("new-project-button")).not.toBeInTheDocument();
  });

  it("eine ähnliche Adresse (/chats/c10) markiert den Chat c1 nicht", () => {
    pathname = "/chats/c10";
    renderSidebar();
    expect(link("Erste Idee")).not.toHaveAttribute("aria-current");
  });

  it("auf einer Projekt-Seite: Neues-Projekt-Knopf (Balken), Projekte mit Ziel und Titel, Stern nur für das angepinnte", () => {
    pathname = "/projects";
    renderSidebar();
    expect(screen.getByTestId("new-project-button")).toHaveAttribute("data-variant", "bar");
    expect(screen.queryByRole("link", { name: "Neuer Chat" })).not.toBeInTheDocument();

    const alpha = link(/Alpha/);
    expect(alpha).toHaveAttribute("href", "/projects/p1");
    expect(alpha).toHaveAttribute("title", "Alpha");
    expect(alpha.querySelector('[aria-label="Angepinnt"]')).toBeInTheDocument();
    expect(link("Beta").querySelector('[aria-label="Angepinnt"]')).toBeNull();
    expect(screen.getAllByLabelText("Angepinnt")).toHaveLength(1);
  });

  it("Unterseiten eines Projekts (Chats, Ergebnisse) gehören zum selben Raum, ein Namensvetter nicht", () => {
    pathname = "/projects/p1/results";
    const { unmount } = renderSidebar();
    expect(link(/Alpha/)).toHaveAttribute("aria-current", "page");
    expect(link("Beta")).not.toHaveAttribute("aria-current");
    unmount();

    pathname = "/projects/p1x";
    renderSidebar();
    expect(link(/Alpha/)).not.toHaveAttribute("aria-current");
  });

  it("welche Liste steht, folgt der Adresse: /projects und /projects/... Projekte, alles andere (auch /projectsx) Chats", () => {
    for (const [path, tab] of [
      ["/projects", "projects"],
      ["/projects/p2", "projects"],
      ["/projectsx", "chats"],
      ["/settings", "chats"],
    ] as const) {
      pathname = path;
      const { unmount } = renderSidebar();
      expect(screen.queryByTestId("new-project-button") !== null, path).toBe(tab === "projects");
      unmount();
    }
  });

  it("das Konto steht unten ausgeklappt und bekommt Adresse, Tarif, Rolle und Namen", () => {
    renderSidebar();
    const menu = screen.getByTestId("account-menu");
    expect(menu).toHaveAttribute("data-collapsed", "false");
    expect(menu).toHaveAttribute("data-email", "anna@example.test");
    expect(menu).toHaveAttribute("data-plan", "pro");
    expect(menu).toHaveAttribute("data-admin", "true");
    expect(menu).toHaveAttribute("data-name", "Anna");
    expect(menu.parentElement?.className).toContain("border-t");
  });
});

describe("Eingeklappt: die Leiste mit den Symbolen", () => {
  it("Neuer Chat als Symbol (Ziel, Beschriftung, Titel), kein Chat-Titel, Konto eingeklappt", () => {
    renderSidebar({ initialCollapsed: true });
    const newChat = link("Neuer Chat");
    expect(newChat).toHaveAttribute("href", "/chats/new");
    expect(newChat).toHaveAttribute("title", "Neuer Chat");
    expect(newChat).toHaveAttribute("aria-label", "Neuer Chat");
    expect(screen.queryByText("Erste Idee")).not.toBeInTheDocument();
    expect(screen.getByTestId("account-menu")).toHaveAttribute("data-collapsed", "true");
  });

  it("die beiden Ziele als Symbole mit Beschriftung, Titel und Ziel, in dieser Reihenfolge", () => {
    renderSidebar({ initialCollapsed: true });
    const chatsLink = link("Chats");
    const projectsLink = link("Projekte");
    expect(chatsLink).toHaveAttribute("href", "/chats");
    expect(chatsLink).toHaveAttribute("title", "Chats");
    expect(projectsLink).toHaveAttribute("href", "/projects");
    expect(projectsLink).toHaveAttribute("title", "Projekte");
    expect(chatsLink.compareDocumentPosition(projectsLink) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(chatsLink.querySelector("svg")?.getAttribute("class") ?? "").toContain("h-4 w-4");
  });

  it("markiert das Ziel der Adresse, auch bei Unterseiten, aber kein Namensvetter und nichts auf /settings", () => {
    const cases: [string, string | null][] = [
      ["/chats", "Chats"],
      ["/chats/c1", "Chats"],
      ["/projects/p1/results", "Projekte"],
      ["/chatsabc", null],
      ["/projectsx", null],
      ["/settings", null],
    ];
    for (const [path, active] of cases) {
      pathname = path;
      const { unmount } = renderSidebar({ initialCollapsed: true });
      for (const name of ["Chats", "Projekte"]) {
        const el = link(name);
        if (name === active) {
          expect(el, `${path} -> ${name}`).toHaveAttribute("aria-current", "page");
          expect(el.className).toContain("bg-accent-subtle");
          expect(el.className).toContain("text-accent-text");
        } else {
          expect(el, `${path} -> ${name}`).not.toHaveAttribute("aria-current");
          expect(el.className).toContain("text-muted-foreground");
        }
      }
      unmount();
    }
  });
});

describe("TabSwitcher (auch vom mobilen Menü benutzt)", () => {
  it("zwei Pillen mit Ziel, Beschriftung (Einzahl) und Symbol, Chat zuerst", () => {
    render(<TabSwitcher tab="chats" />);
    const pills = screen.getAllByRole("link");
    expect(pills.map((p) => p.getAttribute("href"))).toEqual(["/chats", "/projects"]);
    expect(pills.map((p) => p.textContent)).toEqual(["Chat", "Projekt"]);
    for (const pill of pills) expect(pill.querySelector("svg")?.getAttribute("class") ?? "").toContain("h-3.5 w-3.5");
  });

  it("die aktive Pille ist angehoben, die andere gedämpft, genau eine trägt aria-current", () => {
    const { unmount } = render(<TabSwitcher tab="projects" />);
    const [chat, project] = screen.getAllByRole("link");
    expect(project).toHaveAttribute("aria-current", "page");
    expect(project.className).toContain("bg-surface-raised");
    expect(chat).not.toHaveAttribute("aria-current");
    expect(chat.className).toContain("text-secondary");
    expect(chat.className).not.toContain("bg-surface-raised");
    unmount();

    render(<TabSwitcher tab="chats" />);
    const [chat2, project2] = screen.getAllByRole("link");
    expect(chat2.className).toContain("bg-surface-raised");
    expect(project2).not.toHaveAttribute("aria-current");
  });
});

describe("Zeilenstil für Chats, Projekte und das mobile Menü", () => {
  it("ACTIVE_ROW trägt Tönung und Akzentstrich, INACTIVE_ROW den Hover (das mobile Menü rendert dieselben Zeilen)", () => {
    expect(ACTIVE_ROW).toContain("bg-accent-subtle");
    expect(ACTIVE_ROW).toContain("before:w-[3px]");
    expect(ACTIVE_ROW).toContain("font-medium");
    expect(INACTIVE_ROW).toBe("text-foreground/70 hover:bg-surface-hover hover:text-foreground");
  });
});
