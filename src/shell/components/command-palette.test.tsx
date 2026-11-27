import { useEffect, useState } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { act, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { CommandPalette } from "./command-palette";

const push = vi.fn();

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push }),
}));

type Rows = { data: unknown[] | null; error: { message: string } | null };

// Die Antwort je Tabelle. Ohne `serve` sind beide Listen leer.
const load = vi.fn<(table: string) => Promise<Rows>>();

vi.mock("@/shared/supabase/client", () => ({
  createClient: () => ({
    from: (table: string) => ({ select: () => ({ order: () => ({ limit: () => load(table) }) }) }),
  }),
}));

const captureError = vi.fn();

vi.mock("@/shared/lib/observability", () => ({
  captureError: (...args: unknown[]) => captureError(...args),
}));

const rows = (data: unknown[]): Rows => ({ data, error: null });
const chat = (id: string, title: string) => ({ id, title, project_id: null });
type Chat = ReturnType<typeof chat>;

function serve(chats: Chat[], projects: { id: string; name: string }[] = []) {
  load.mockImplementation(async (table) => rows(table === "conversations" ? chats : projects));
}

/** Hält die Chat-Liste zurück, bis der Test sie liefert. */
function holdChats() {
  let resolve!: (value: Rows) => void;
  const pending = new Promise<Rows>((r) => {
    resolve = r;
  });
  load.mockImplementation((table) => (table === "conversations" ? pending : Promise.resolve(rows([]))));
  return (chats: Chat[]) => act(async () => resolve(rows(chats)));
}

beforeEach(() => {
  push.mockClear();
  captureError.mockClear();
  load.mockReset();
  serve([]);
});

// Wie die Seitenleiste: Strg+K schaltet um, die Palette bittet selbst um Schliessen.
function Harness() {
  const [open, setOpen] = useState(false);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setOpen((v) => !v);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);
  return (
    <>
      <textarea aria-label="Nachricht an Finn" />
      <CommandPalette open={open} onClose={() => setOpen(false)} />
    </>
  );
}

// Der Fokus kommt erst einen Moment nach dem Öffnen. Eine Taste davor ginge noch an das vorige Element.
async function focusedField() {
  const field = within(await screen.findByRole("dialog")).getByRole("textbox");
  await waitFor(() => expect(field).toHaveFocus());
  return field;
}

async function openFromComposer() {
  const user = userEvent.setup();
  render(<Harness />);
  const composer = screen.getByLabelText("Nachricht an Finn");
  composer.focus();
  await user.keyboard("{Control>}k{/Control}");
  const field = await focusedField();
  return { user, composer, field };
}

describe("Befehlspalette: Fokus (#151)", () => {
  it("gibt den Fokus nach Escape an das Eingabefeld zurück, das ihn vorher hatte", async () => {
    const { user, composer } = await openFromComposer();
    await user.keyboard("{Escape}");
    expect(composer).toHaveFocus();
    expect(document.body).not.toHaveFocus();
  });

  it("gibt ihn auch bei einem Klick neben die Palette zurück", async () => {
    const { composer } = await openFromComposer();
    fireEvent.mouseDown(screen.getByRole("dialog").parentElement as HTMLElement);
    await waitFor(() => expect(composer).toHaveFocus());
  });

  it("gibt ihn auch zurück, wenn Strg+K sie wieder zuklappt", async () => {
    const { user, composer } = await openFromComposer();
    await user.keyboard("{Control>}k{/Control}");
    expect(composer).toHaveFocus();
  });

  it("holt den Fokus nicht zurück, wenn ein Eintrag die Seite wechselt", async () => {
    const { user, composer } = await openFromComposer();
    await user.keyboard("{Enter}");
    expect(push).toHaveBeenCalledTimes(1);
    expect(composer).not.toHaveFocus();
  });

  it("merkt sich den Fokus bei jedem Öffnen neu", async () => {
    const { user, composer } = await openFromComposer();
    await user.keyboard("{Escape}");
    expect(composer).toHaveFocus();

    const other = document.createElement("button");
    document.body.appendChild(other);
    other.focus();
    await user.keyboard("{Control>}k{/Control}");
    await focusedField();
    await user.keyboard("{Escape}");
    // Der Fokus kommt nach dem Schliessen zurück, unter Last erst einen Moment später.
    await waitFor(() => expect(other).toHaveFocus());
    other.remove();
  });
});

describe("Befehlspalette: Tab bleibt drinnen (#368)", () => {
  it("läuft vom Suchfeld rückwärts zur letzten Zeile und von dort wieder zum Feld", async () => {
    serve([chat("c1", "Letzter Chat")]);
    const { user, composer, field } = await openFromComposer();
    const last = await screen.findByRole("button", { name: "Letzter Chat" });

    await user.tab({ shift: true });
    expect(last).toHaveFocus();
    await user.tab();
    expect(field).toHaveFocus();
    expect(composer).not.toHaveFocus();
  });

  it("schliesst mit Escape auch, wenn der Fokus auf einer Zeile liegt", async () => {
    const { user, composer } = await openFromComposer();
    await user.tab();
    await user.keyboard("{Escape}");
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
    expect(composer).toHaveFocus();
  });
});

/** Die Beschriftung der markierten Zeile. */
const marked = () => document.querySelector('[data-active="true"]')?.textContent;
const row = (name: string) => screen.getByRole("button", { name });

const ZETA = [chat("c1", "Zeta eins"), chat("c2", "Zeta zwei"), chat("c3", "Zeta drei")];

type User = ReturnType<typeof userEvent.setup>;

async function reopen(user: User) {
  await user.keyboard("{Escape}");
  await user.keyboard("{Control>}k{/Control}");
  return focusedField();
}

describe("Befehlspalette: Markierung (#420)", () => {
  async function openWithChats() {
    serve(ZETA);
    const opened = await openFromComposer();
    await screen.findByRole("button", { name: "Zeta drei" });
    return opened;
  }

  it("markiert nach einer Sucheingabe den ersten Treffer, Enter öffnet ihn", async () => {
    const { user, field } = await openWithChats();
    await user.keyboard("{ArrowDown}{ArrowDown}{ArrowDown}");

    await user.type(field, "zeta");
    expect(marked()).toBe("Zeta eins");

    // Auch wenn die gewählte Zeile in den Treffern bleibt.
    await user.keyboard("{ArrowDown}");
    expect(marked()).toBe("Zeta zwei");
    await user.type(field, " ");
    expect(marked()).toBe("Zeta eins");

    await user.keyboard("{Enter}");
    expect(push).toHaveBeenCalledWith("/chats/c1");
  });

  it("beginnt bei jedem Öffnen wieder oben", async () => {
    const { user } = await openWithChats();
    const first = marked();
    await user.keyboard("{ArrowDown}{ArrowDown}");
    expect(marked()).not.toBe(first);

    await reopen(user);
    expect(marked()).toBe(first);
  });

  it("bleibt mit den Pfeiltasten an beiden Enden stehen", async () => {
    const { user, field } = await openWithChats();
    await user.type(field, "zeta");

    await user.keyboard("{ArrowUp}");
    expect(marked()).toBe("Zeta eins");
    await user.keyboard("{ArrowDown}{ArrowDown}{ArrowDown}{ArrowDown}");
    expect(marked()).toBe("Zeta drei");
    await user.keyboard("{ArrowUp}");
    expect(marked()).toBe("Zeta zwei");
  });

  it("markiert wieder den ersten Treffer, wenn nach ↓ ohne Treffer die Suche korrigiert wird", async () => {
    const { user, field } = await openWithChats();
    await user.type(field, "zetax");
    await user.keyboard("{ArrowDown}{Enter}");
    expect(push).not.toHaveBeenCalled();

    await user.type(field, "{Backspace}");
    expect(marked()).toBe("Zeta eins");
    await user.keyboard("{Enter}");
    expect(push).toHaveBeenCalledWith("/chats/c1");
  });

  it("folgt der Maus nur, wenn sie sich bewegt", async () => {
    const { user, field } = await openWithChats();
    await user.type(field, "zeta");

    // Eine Zeile, die unter den ruhenden Zeiger rutscht, meldet nur das Betreten.
    fireEvent.mouseOver(row("Zeta zwei"));
    expect(marked()).toBe("Zeta eins");

    fireEvent.mouseMove(row("Zeta zwei"));
    expect(marked()).toBe("Zeta zwei");
  });

  it("rollt nach einer Sucheingabe zur Markierung, auch wenn sie die erste Zeile bleibt", async () => {
    const scroll = vi.spyOn(Element.prototype, "scrollIntoView");
    const { user, field } = await openWithChats();
    await user.type(field, "zeta");
    scroll.mockClear();

    await user.type(field, " ");
    expect(scroll.mock.contexts).toContain(row("Zeta eins"));
    scroll.mockRestore();
  });

  it("bleibt auf demselben Eintrag, wenn die frisch gelesene Liste ankommt", async () => {
    const { user } = await openWithChats();
    const deliver = holdChats();
    const field = await reopen(user);
    await user.type(field, "zeta");
    await user.keyboard("{ArrowDown}");
    expect(marked()).toBe("Zeta zwei");

    await deliver([chat("c4", "Zeta neu"), ...ZETA]);
    expect(row("Zeta neu")).toBeInTheDocument();
    expect(marked()).toBe("Zeta zwei");
    await user.keyboard("{Enter}");
    expect(push).toHaveBeenCalledWith("/chats/c2");
  });

  it("markiert den ersten Treffer, wenn der gewählte Eintrag inzwischen gelöscht ist", async () => {
    const { user } = await openWithChats();
    const deliver = holdChats();
    const field = await reopen(user);
    await user.type(field, "zeta");
    await user.keyboard("{ArrowDown}{ArrowDown}");
    expect(marked()).toBe("Zeta drei");

    await deliver(ZETA.slice(0, 2));
    expect(marked()).toBe("Zeta eins");
  });
});

describe("Befehlspalette: Listen (#420)", () => {
  async function openWithOldChat() {
    serve([chat("c1", "Alter Chat")]);
    const opened = await openFromComposer();
    await screen.findByRole("button", { name: "Alter Chat" });
    return opened;
  }

  it("liest Chats und Projekte bei jedem Öffnen neu", async () => {
    const { user } = await openWithOldChat();
    expect(load).toHaveBeenCalledTimes(2);

    serve([chat("c2", "Frisch angelegt")], [{ id: "p1", name: "Neues Projekt Alpha" }]);
    await reopen(user);

    expect(await screen.findByRole("button", { name: "Frisch angelegt" })).toBeInTheDocument();
    expect(row("Neues Projekt Alpha")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Alter Chat" })).not.toBeInTheDocument();
    expect(load).toHaveBeenCalledTimes(4);
  });

  it("lässt die vorige Liste stehen, bis die neue da ist", async () => {
    const { user } = await openWithOldChat();
    const deliver = holdChats();
    await reopen(user);
    expect(row("Alter Chat")).toBeInTheDocument();

    await deliver([chat("c2", "Frisch angelegt")]);
    expect(row("Frisch angelegt")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Alter Chat" })).not.toBeInTheDocument();
  });

  it("behält nach einem Lesefehler die vorige Liste und meldet ihn", async () => {
    const { user } = await openWithOldChat();
    const failure = { message: "offline" };
    load.mockImplementation(async (table) =>
      table === "conversations" ? { data: null, error: failure } : rows([{ id: "p1", name: "Projekt Alpha" }])
    );
    await reopen(user);

    expect(await screen.findByRole("button", { name: "Projekt Alpha" })).toBeInTheDocument();
    expect(row("Alter Chat")).toBeInTheDocument();
    expect(captureError).toHaveBeenCalledWith("palette.load_failed", failure);
  });

  it("lässt sich von der verspäteten Antwort eines früheren Öffnens nichts überschreiben", async () => {
    const deliverLate = holdChats();
    const { user } = await openFromComposer();

    serve([chat("c2", "Frisch angelegt")]);
    await reopen(user);
    await screen.findByRole("button", { name: "Frisch angelegt" });

    await deliverLate([chat("c1", "Alter Chat")]);
    expect(row("Frisch angelegt")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Alter Chat" })).not.toBeInTheDocument();
  });
});
