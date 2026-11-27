import { createElement } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Chat } from "./chat";

// Was beim Schreiben und Tippen NICHT neu gezeichnet werden darf (#418): jedes Textstück zeichnet <Chat> neu, und
// jede neu gezeichnete Antwort parst ihr Markdown von vorn. Gezählt wird an den Bausteinen, aus denen die Zeilen
// bestehen: ReactMarkdown (ein Rendern ist ein Parsen), das Symbol "Export" unter jeder Antwort und die Anhänge über
// jeder eigenen Frage.

const seen = vi.hoisted(() => ({ parsed: [] as string[], replies: 0, questions: 0 }));

vi.mock("react-markdown", async (importOriginal) => {
  const actual = await importOriginal<typeof import("react-markdown")>();
  return {
    ...actual,
    default: (props: Parameters<typeof actual.default>[0]) => {
      seen.parsed.push(String(props.children));
      return createElement(actual.default, props);
    },
  };
});
vi.mock("lucide-react", async (importOriginal) => {
  const actual = await importOriginal<typeof import("lucide-react")>();
  return {
    ...actual,
    Download: (props: object) => {
      seen.replies++;
      return createElement(actual.Download, props);
    },
  };
});
vi.mock("./attachment-chips", async (importOriginal) => {
  const actual = await importOriginal<typeof import("./attachment-chips")>();
  return {
    ...actual,
    MessageAttachments: (props: Parameters<typeof actual.MessageAttachments>[0]) => {
      seen.questions++;
      return createElement(actual.MessageAttachments, props);
    },
  };
});
vi.mock("next/navigation", () => ({ useRouter: () => ({ replace: vi.fn(), refresh: vi.fn() }) }));
vi.mock("@/shared/ui/toast", () => ({ useToast: () => ({ toast: vi.fn() }) }));

const frame = (event: string, data: unknown) => `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
const encoder = new TextEncoder();

/** Ein Strom, den der Test Stück für Stück füttert. */
function openStream() {
  const handle: { controller?: ReadableStreamDefaultController<Uint8Array> } = {};
  const body = new ReadableStream<Uint8Array>({ start: (c) => void (handle.controller = c) });
  const send = (event: string, data: unknown) =>
    act(async () => void handle.controller!.enqueue(encoder.encode(frame(event, data))));
  const close = () => act(async () => handle.controller!.close());
  return { response: { ok: true, body, json: async () => ({}) }, send, close };
}

const id = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`;
const file = (n: number) => ({ id: `a${n}`, name: `datei-${n}.md`, kind: "text" as const, mediaType: "text/plain", sizeBytes: 10 });
/** Drei Fragen mit Datei und drei Antworten mit Codeblock; die letzte Antwort steht im Ergebnis-Panel. */
const history = [1, 3, 5].flatMap((n) => [
  { id: id(n), role: "user" as const, content: `Frage ${n}`, attachments: [file(n)] },
  { id: id(n + 1), role: "assistant" as const, content: `Alte Antwort ${n + 1}\n\n\`\`\`text\nPrompt ${n + 1}\n\`\`\`` },
]);
const oldParses = () => seen.parsed.filter((text) => text.startsWith("Alte Antwort"));
const reset = () => {
  seen.parsed.length = 0;
  seen.replies = 0;
  seen.questions = 0;
};

beforeEach(() => {
  vi.unstubAllGlobals();
  reset();
});
afterEach(() => vi.unstubAllGlobals());

describe("fertige Nachrichten bleiben stehen (#418)", () => {
  it("beim Streamen: kein Textstück zeichnet oder parst den Verlauf neu", async () => {
    const stream = openStream();
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(stream.response));
    render(<Chat initialMessages={history} initialConversationId="c" />);
    // Die Zähler hängen wirklich an den Zeilen, sonst bewiese eine Null nichts.
    expect(oldParses()).toHaveLength(3);
    expect(seen.replies).toBeGreaterThanOrEqual(3);
    expect(seen.questions).toBe(3);

    const user = userEvent.setup();
    await user.type(screen.getByRole("textbox"), "Weiter");
    await user.click(screen.getByRole("button", { name: /Senden/ }));
    // Das Ausschreiben läuft über requestAnimationFrame; auf einem ausgelasteten Rechner braucht es länger.
    const written = (word: string) => screen.findByText(new RegExp(word), undefined, { timeout: 5000 });
    await stream.send("delta", { text: "Eins " });
    await written("Eins");
    reset();

    for (const word of ["Zwei", "Drei", "Vier"]) {
      await stream.send("delta", { text: `${word} ` });
      await written(word);
    }

    // Geschrieben wurde: die laufende Antwort ist neu geparst worden.
    expect(seen.parsed.some((text) => text.includes("Vier"))).toBe(true);
    expect(oldParses()).toEqual([]);
    expect(seen.replies).toBe(0);
    expect(seen.questions).toBe(0);

    await stream.send("done", { conversationId: "c" });
    await stream.close();
    await screen.findByRole("button", { name: /Senden/ });
  });

  it("beim Tippen im Eingabefeld: der Verlauf bleibt stehen", async () => {
    render(<Chat initialMessages={history} initialConversationId="c" />);
    reset();

    await userEvent.setup().type(screen.getByRole("textbox"), "Noch etwas");

    expect(screen.getByRole("textbox")).toHaveValue("Noch etwas");
    expect(seen.parsed).toEqual([]);
    expect(seen.replies).toBe(0);
    expect(seen.questions).toBe(0);
  });

  // Die Kehrseite stehenbleibender Zeilen: ihre Rückrufe dürfen trotzdem nie einen alten Stand sehen.
  it("Bearbeiten an einer stehengebliebenen Frage ersetzt auch, was seither dazukam", async () => {
    const first = openStream();
    const second = openStream();
    vi.stubGlobal("fetch", vi.fn().mockResolvedValueOnce(first.response).mockResolvedValueOnce(second.response));
    render(<Chat initialMessages={history} initialConversationId="c" />);
    const user = userEvent.setup();

    await user.type(screen.getByRole("textbox"), "Dazugekommen");
    await user.click(screen.getByRole("button", { name: /Senden/ }));
    await first.send("meta", { conversationId: "c", userMessageId: id(7) });
    await first.send("delta", { text: "Neue Antwort" });
    await first.send("done", { conversationId: "c", assistantMessageId: id(8) });
    await first.close();
    await screen.findByRole("button", { name: /Senden/ });

    // Die erste Frage der Liste; ihre Zeile wurde seit dem Laden nicht neu aufgebaut.
    const log = screen.getByRole("log");
    await user.click(within(log).getAllByRole("button", { name: "Nachricht bearbeiten" })[0]);
    const field = screen.getByRole("textbox", { name: "Nachricht bearbeiten" });
    await user.clear(field);
    await user.type(field, "Erste Frage, neu");
    await user.click(screen.getByRole("button", { name: "Neu senden" }));

    await waitFor(() => expect(fetch).toHaveBeenCalledTimes(2));
    const sent = JSON.parse((fetch as ReturnType<typeof vi.fn>).mock.calls[1][1].body);
    expect(sent.supersededMessageIds).toEqual([1, 2, 3, 4, 5, 6, 7, 8].map(id));
    expect(sent.messages).toHaveLength(1);
  });
});
