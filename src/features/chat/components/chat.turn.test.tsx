import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Chat } from "./chat";
import { MAX_TRANSCRIPT_MESSAGES } from "@/shared/lib/chat-limits";

// Der Zustandsautomat eines Chat-Zugs in <Chat> (Betriebs-Audit M7, Teil 4): Senden, Abbruch, Fehler,
// Wiederholen, Neu erzeugen, Bearbeiten. chat.test.tsx deckt das meiste über die Oberfläche ab. Hier steht, was
// dort fehlte und was beim Zerlegen von chat.tsx in Hooks und Teilkomponenten leicht still verloren ginge:
// Abbruch beim Verlassen, was über die Leitung geht, der Zustand NACH einem gescheiterten Neu-Erzeugen oder
// Bearbeiten, und dass nichts Beschäftigtes sich umschreiben lässt.

const replace = vi.fn();
const refresh = vi.fn();
vi.mock("next/navigation", () => ({ useRouter: () => ({ replace, refresh }) }));

const frame = (event: string, data: unknown) => `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
const encoder = new TextEncoder();

/** Ein Strom, der nach den gegebenen Rahmen sofort schließt. */
function streamOf(frames: string[]): ReadableStream<Uint8Array> {
  return new ReadableStream<Uint8Array>({
    start(controller) {
      for (const f of frames) controller.enqueue(encoder.encode(f));
      controller.close();
    },
  });
}
function okFetch(deltas: string[], done: Record<string, unknown> = {}) {
  return vi.fn().mockResolvedValue({
    ok: true,
    body: streamOf([...deltas.map((text) => frame("delta", { text })), frame("done", done)]),
    json: async () => ({}),
  });
}
/** Ein Strom, der offen bleibt, bis der Test ihn schließt (ein Zug "in der Luft"). */
function hangingFetch() {
  const handle: { controller?: ReadableStreamDefaultController<Uint8Array>; signal?: AbortSignal } = {};
  const body = new ReadableStream<Uint8Array>({ start: (c) => void (handle.controller = c) });
  const fetchMock = vi.fn(async (_url: string, init: RequestInit) => {
    handle.signal = init.signal as AbortSignal;
    return { ok: true, body, json: async () => ({}) };
  });
  return { fetchMock, handle };
}
const sentBody = (call = 0) => JSON.parse((fetch as ReturnType<typeof vi.fn>).mock.calls[call][1].body);

const U1 = "11111111-1111-4111-8111-111111111111";
const A1 = "22222222-2222-4222-8222-222222222222";
const U2 = "33333333-3333-4333-8333-333333333333";
const A2 = "44444444-4444-4444-8444-444444444444";
const thread = [
  { id: U1, role: "user" as const, content: "Erste Frage" },
  { id: A1, role: "assistant" as const, content: "Erste Antwort" },
  { id: U2, role: "user" as const, content: "Zweite Frage" },
  { id: A2, role: "assistant" as const, content: "Zweite Antwort" },
];

beforeEach(() => {
  replace.mockReset();
  refresh.mockReset();
  vi.unstubAllGlobals();
});
afterEach(() => {
  vi.unstubAllGlobals();
});

describe("Verlassen mitten im Zug", () => {
  it("bricht die laufende Anfrage ab, sobald der Chat verschwindet (kein bezahlter Text für niemanden)", async () => {
    const { fetchMock, handle } = hangingFetch();
    vi.stubGlobal("fetch", fetchMock);
    const { unmount } = render(<Chat />);
    const user = userEvent.setup();

    await user.type(screen.getByRole("textbox"), "Hallo");
    await user.click(screen.getByRole("button", { name: /Senden/ }));
    await waitFor(() => expect(handle.signal).toBeDefined());
    expect(handle.signal!.aborted).toBe(false);

    unmount();

    expect(handle.signal!.aborted).toBe(true);
  });

  it("navigiert nach dem Verlassen nicht mehr (kein router.replace auf einer toten Instanz)", async () => {
    const { fetchMock, handle } = hangingFetch();
    vi.stubGlobal("fetch", fetchMock);
    const { unmount } = render(<Chat />);
    const user = userEvent.setup();

    await user.type(screen.getByRole("textbox"), "Hallo");
    await user.click(screen.getByRole("button", { name: /Senden/ }));
    await waitFor(() => expect(handle.controller).toBeDefined());
    unmount();

    // Das "done" kommt trotzdem noch an (eine Wettlaufbedingung), und es darf nichts mehr bewegen.
    try {
      handle.controller!.enqueue(encoder.encode(frame("done", { conversationId: "conv-9" })));
      handle.controller!.close();
    } catch {
      // Ein bereits abgebrochener Strom nimmt nichts mehr an: auch gut.
    }
    await new Promise((resolve) => setTimeout(resolve, 20));
    expect(replace).not.toHaveBeenCalled();
  });
});

describe("was über die Leitung geht", () => {
  it("schickt höchstens die neuesten Nachrichten, die älteren nur als Zeilen-ID, Rolle und Text", async () => {
    const many = Array.from({ length: MAX_TRANSCRIPT_MESSAGES + 6 }, (_, i) => ({
      id: `00000000-0000-4000-8000-${String(i).padStart(12, "0")}`,
      role: (i % 2 === 0 ? "user" : "assistant") as "user" | "assistant",
      content: `m${i}`,
    }));
    // Endet auf "assistant"; die nächste Frage hängt eine Nutzer-Nachricht an.
    vi.stubGlobal("fetch", okFetch(["ok"], { conversationId: "c" }));
    render(<Chat initialMessages={many} initialConversationId="c" />);
    const user = userEvent.setup();

    await user.type(screen.getByRole("textbox"), "Neue Frage");
    await user.click(screen.getByRole("button", { name: /Senden/ }));

    const body = sentBody();
    expect(body.messages).toHaveLength(MAX_TRANSCRIPT_MESSAGES);
    expect(body.messages.at(-1)).toMatchObject({ role: "user", content: "Neue Frage" });
    // Ältere Nachrichten tragen nie Anhänge-Bytes.
    for (const message of body.messages.slice(0, -1)) expect(message).not.toHaveProperty("attachments");
    expect(body.conversationId).toBe("c");
  });

  it("schickt die Projekt-ID eines Projekt-Chats mit", async () => {
    vi.stubGlobal("fetch", okFetch(["ok"], { conversationId: "c" }));
    render(<Chat projectId="99999999-9999-4999-8999-999999999999" />);
    const user = userEvent.setup();

    await user.type(screen.getByRole("textbox"), "Hi");
    await user.click(screen.getByRole("button", { name: /Senden/ }));

    expect(sentBody().projectId).toBe("99999999-9999-4999-8999-999999999999");
  });

  it("navigiert in einem Projekt-Chat zur Projekt-Adresse, in einem freien zur kanonischen", async () => {
    vi.stubGlobal("fetch", okFetch(["ok"], { conversationId: "conv-7" }));
    render(<Chat projectId="99999999-9999-4999-8999-999999999999" />);
    const user = userEvent.setup();
    await user.type(screen.getByRole("textbox"), "Hi");
    await user.click(screen.getByRole("button", { name: /Senden/ }));

    await waitFor(() =>
      expect(replace).toHaveBeenCalledWith("/projects/99999999-9999-4999-8999-999999999999/chats/conv-7", {
        scroll: false,
      })
    );
  });
});

describe("Neu erzeugen", () => {
  it("schneidet die letzte Antwort ab, schickt die Frage erneut und nennt die alte Antwort als zu ersetzende", async () => {
    const { fetchMock, handle } = hangingFetch();
    vi.stubGlobal("fetch", fetchMock);
    render(<Chat initialMessages={thread} initialConversationId="c" />);
    const user = userEvent.setup();

    await user.click(screen.getByRole("button", { name: /Neu erzeugen/ }));
    await waitFor(() => expect(handle.signal).toBeDefined());

    const body = sentBody();
    expect(body.replaceMessageId).toBe(A2);
    expect(body.messages.at(-1)).toMatchObject({ id: U2, role: "user", content: "Zweite Frage" });
    expect(body.messages.map((m: { id: string }) => m.id)).not.toContain(A2);
    expect(body).not.toHaveProperty("supersededMessageIds");
    // Während des Zugs steht die alte Antwort nicht mehr da, die Frage aber schon.
    const log = screen.getByRole("log");
    expect(within(log).queryByText("Zweite Antwort")).not.toBeInTheDocument();
    expect(within(log).getByText("Zweite Frage")).toBeInTheDocument();
  });

  it("stellt bei einem Fehler die alte Antwort wieder her, statt den Verlauf zu verkürzen", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: false, json: async () => ({ detail: "Kaputt" }) }));
    render(<Chat initialMessages={thread} initialConversationId="c" />);
    const user = userEvent.setup();

    await user.click(screen.getByRole("button", { name: /Neu erzeugen/ }));

    expect(await screen.findByRole("alert")).toHaveTextContent("Kaputt");
    expect(within(screen.getByRole("log")).getByText("Zweite Antwort")).toBeInTheDocument();
  });

  it("gibt es nur im Ruhezustand: nicht, solange ein Zug läuft", async () => {
    const { fetchMock, handle } = hangingFetch();
    vi.stubGlobal("fetch", fetchMock);
    render(<Chat initialMessages={thread} initialConversationId="c" />);
    const user = userEvent.setup();

    expect(screen.getByRole("button", { name: /Neu erzeugen/ })).toBeInTheDocument();
    await user.type(screen.getByRole("textbox"), "Weiter");
    await user.click(screen.getByRole("button", { name: /Senden/ }));
    await waitFor(() => expect(handle.signal).toBeDefined());

    expect(screen.queryByRole("button", { name: /Neu erzeugen/ })).not.toBeInTheDocument();
  });

  it("gibt es nicht ohne Antwort", () => {
    render(<Chat initialMessages={[{ id: U1, role: "user", content: "Nur eine Frage" }]} initialConversationId="c" />);
    expect(screen.queryByRole("button", { name: /Neu erzeugen/ })).not.toBeInTheDocument();
  });
});

describe("Bearbeiten", () => {
  async function edit(user: ReturnType<typeof userEvent.setup>, label: string, next: string) {
    // Die Stifte stehen an den Nutzer-Nachrichten; die zweite ist die zweite Frage.
    const buttons = screen.getAllByRole("button", { name: "Nachricht bearbeiten" });
    await user.click(buttons[label === "erste" ? 0 : 1]);
    const field = screen.getByRole("textbox", { name: "Nachricht bearbeiten" });
    await user.clear(field);
    await user.type(field, next);
    await user.click(screen.getByRole("button", { name: "Neu senden" }));
  }

  it("ersetzt die Frage UND alles danach und nennt die überholten Zeilen", async () => {
    const { fetchMock, handle } = hangingFetch();
    vi.stubGlobal("fetch", fetchMock);
    render(<Chat initialMessages={thread} initialConversationId="c" />);
    const user = userEvent.setup();

    await edit(user, "erste", "Geänderte erste Frage");
    await waitFor(() => expect(handle.signal).toBeDefined());

    const body = sentBody();
    expect(body.supersededMessageIds).toEqual([U1, A1, U2, A2]);
    expect(body.messages).toHaveLength(1);
    expect(body.messages[0]).toMatchObject({ role: "user", content: "Geänderte erste Frage" });
    expect(body.messages[0].id).not.toBe(U1);
    expect(body).not.toHaveProperty("replaceMessageId");
    const log = screen.getByRole("log");
    expect(within(log).queryByText("Erste Antwort")).not.toBeInTheDocument();
    expect(within(log).getByText("Geänderte erste Frage")).toBeInTheDocument();
  });

  it("stellt bei einem Fehler den ganzen alten Verlauf wieder her", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: false, json: async () => ({ detail: "Kaputt" }) }));
    render(<Chat initialMessages={thread} initialConversationId="c" />);
    const user = userEvent.setup();

    await edit(user, "erste", "Geänderte erste Frage");

    expect(await screen.findByRole("alert")).toHaveTextContent("Kaputt");
    const log = screen.getByRole("log");
    expect(within(log).getByText("Erste Frage")).toBeInTheDocument();
    expect(within(log).getByText("Zweite Antwort")).toBeInTheDocument();
  });

  it("schickt nichts, wenn der Text gleich geblieben ist", async () => {
    const spy = vi.fn();
    vi.stubGlobal("fetch", spy);
    render(<Chat initialMessages={thread} initialConversationId="c" />);
    const user = userEvent.setup();

    await user.click(screen.getAllByRole("button", { name: "Nachricht bearbeiten" })[0]);
    await user.click(screen.getByRole("button", { name: "Neu senden" }));

    expect(spy).not.toHaveBeenCalled();
  });

  it("bietet während eines laufenden Zugs keinen Stift an", async () => {
    const { fetchMock, handle } = hangingFetch();
    vi.stubGlobal("fetch", fetchMock);
    render(<Chat initialMessages={thread} initialConversationId="c" />);
    const user = userEvent.setup();

    expect(screen.getAllByRole("button", { name: "Nachricht bearbeiten" })).toHaveLength(2);
    await user.type(screen.getByRole("textbox"), "Weiter");
    await user.click(screen.getByRole("button", { name: /Senden/ }));
    await waitFor(() => expect(handle.signal).toBeDefined());

    expect(screen.queryByRole("button", { name: "Nachricht bearbeiten" })).not.toBeInTheDocument();
  });
});

describe("Sprachmodus", () => {
  it("ersetzt das Eingabefeld durch die Sprachleiste und gibt es beim Schließen zurück", async () => {
    render(<Chat />);
    const user = userEvent.setup();

    await user.click(screen.getByRole("button", { name: "Sprachmodus öffnen" }));
    expect(screen.queryByRole("textbox")).not.toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Sprachmodus schliessen" }));
    expect(screen.getByRole("textbox")).toBeInTheDocument();
  });
});

describe("Stopp, wenn der Strom schon geschlossen ist und nur noch geschrieben wird", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it("zeigt den Rest sofort und ohne Fehler, statt die Schreibanimation abzuwarten", async () => {
    // Die Schreibanimation läuft über requestAnimationFrame. Eingefroren, kommt die Antwort nie von allein
    // zu Ende: genau der Zustand "Strom zu, Text noch nicht ganz da", in dem der Stopp-Knopf stehen bleibt.
    vi.useFakeTimers({ toFake: ["requestAnimationFrame", "cancelAnimationFrame"] });
    vi.stubGlobal("fetch", okFetch(["Fertiger Text"], { conversationId: "c" }));
    render(<Chat initialConversationId="c" />);
    const user = userEvent.setup();

    await user.type(screen.getByRole("textbox"), "Hi");
    await user.click(screen.getByRole("button", { name: /Senden/ }));
    // Der Strom ist zu, aber der Zug gilt noch als laufend (Stopp statt Senden).
    const stop = await screen.findByRole("button", { name: /stoppen/ });
    expect(screen.queryByText("Fertiger Text")).not.toBeInTheDocument();

    await user.click(stop);

    expect(await screen.findByText("Fertiger Text")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Senden/ })).toBeInTheDocument();
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });
});

describe("Antwort, die schon im Gang ist", () => {
  it("ein zweites Senden während des Zugs wird ignoriert (kein zweiter Request)", async () => {
    const { fetchMock, handle } = hangingFetch();
    vi.stubGlobal("fetch", fetchMock);
    render(<Chat />);
    const user = userEvent.setup();

    await user.type(screen.getByRole("textbox"), "Eins");
    await user.click(screen.getByRole("button", { name: /Senden/ }));
    await waitFor(() => expect(handle.signal).toBeDefined());
    // Der Senden-Knopf ist zum Stopp-Knopf geworden; Enter im Feld sendet nicht noch einmal.
    await user.type(screen.getByRole("textbox"), "Zwei{Enter}");

    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});
