import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Chat } from "./chat";

// Verfeinern per Tipp (#245) und Antwortvorschläge zu Finns Rückfrage (#225), durch die ganze Oberfläche: was ein
// Tipp wirklich über die Leitung schickt und was er im Eingabefeld tut.

vi.mock("next/navigation", () => ({ useRouter: () => ({ replace: vi.fn(), refresh: vi.fn() }) }));
vi.mock("@/shared/ui/toast", () => ({ useToast: () => ({ toast: vi.fn() }) }));
vi.mock("@/shared/supabase/client", () => ({
  createClient: () => ({
    auth: { getUser: vi.fn().mockResolvedValue({ data: { user: null } }) },
    from: () => ({ insert: vi.fn() }),
  }),
}));

const frame = (event: string, data: unknown) => `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
const encoder = new TextEncoder();
function okFetch(text: string) {
  return vi.fn().mockResolvedValue({
    ok: true,
    body: new ReadableStream<Uint8Array>({
      start(controller) {
        controller.enqueue(encoder.encode(frame("delta", { text })));
        controller.enqueue(encoder.encode(frame("done", { conversationId: "c" })));
        controller.close();
      },
    }),
    json: async () => ({}),
  });
}
function hangingFetch() {
  return vi.fn(async () => ({ ok: true, body: new ReadableStream<Uint8Array>({ start: () => undefined }), json: async () => ({}) }));
}
const calls = () => (fetch as ReturnType<typeof vi.fn>).mock.calls;
const sentBody = (call = 0) => JSON.parse(calls()[call][1].body);

const U1 = "11111111-1111-4111-8111-111111111111";
const A1 = "22222222-2222-4222-8222-222222222222";
const U2 = "33333333-3333-4333-8333-333333333333";
const A2 = "44444444-4444-4444-8444-444444444444";
const PROMPT = "```text\nDu bist ein Tutor. Erkläre mir Brüche.\n```";
const withPrompt = [
  { id: U1, role: "user" as const, content: "Erklär mir Brüche" },
  { id: A1, role: "assistant" as const, content: `Älterer Prompt:\n\n${PROMPT}` },
  { id: U2, role: "user" as const, content: "Und jetzt bitte so, dass es ein Kind versteht" },
  { id: A2, role: "assistant" as const, content: `Hier ist er:\n\n${PROMPT}` },
];
const withQuestion = [
  { id: U1, role: "user" as const, content: "Ein Brief an meinen Vermieter" },
  {
    id: A1,
    role: "assistant" as const,
    content: "Wie soll der Brief klingen?\n\n```choices\nTon? | sachlich | freundlich | locker\nLänge? | kurz | ausführlich\n```",
  },
];

beforeEach(() => vi.unstubAllGlobals());
afterEach(() => vi.unstubAllGlobals());

describe("Verfeinern per Tipp (#245)", () => {
  it("zeigt die Tippflächen nur am neuesten Ergebnis mit Prompt", () => {
    render(<Chat initialMessages={withPrompt} initialConversationId="c" />);
    const groups = screen.getAllByRole("group", { name: "Prompt anpassen" });
    expect(groups).toHaveLength(1);
    expect(within(groups[0]).getAllByRole("button").map((b) => b.textContent)).toEqual([
      "Kürzer",
      "Ausführlicher",
      "Förmlicher",
      "Lockerer",
      "Auf Englisch",
      "Anderes",
    ]);
    // Die ältere Antwort ist eine Blase ohne Verfeinern.
    expect(screen.getByRole("region", { name: "Aktuelle Antwort von Finn" })).toContainElement(groups[0]);
  });

  it("zeigt sie nicht unter einer Rückfrage ohne Prompt", () => {
    render(<Chat initialMessages={[withPrompt[0], { id: A1, role: "assistant", content: "Für wen ist er?" }]} initialConversationId="c" />);
    expect(screen.queryByRole("group", { name: "Prompt anpassen" })).not.toBeInTheDocument();
  });

  it("zeigt sie nicht in einem leeren Chat", () => {
    render(<Chat />);
    expect(screen.queryByRole("group", { name: "Prompt anpassen" })).not.toBeInTheDocument();
  });

  it("schickt mit einem Tipp genau eine Nachricht, in der Sprache der Oberfläche, und zeigt sie im Verlauf", async () => {
    vi.stubGlobal("fetch", okFetch("Neuer Prompt"));
    render(<Chat initialMessages={withPrompt} initialConversationId="c" />);
    const user = userEvent.setup();

    await user.click(screen.getByRole("button", { name: "Kürzer" }));

    await waitFor(() => expect(calls()).toHaveLength(1));
    const body = sentBody();
    expect(body.messages.at(-1)).toMatchObject({
      role: "user",
      content: "Mach den Prompt kürzer. Gib ihn vollständig in einem neuen Codeblock aus.",
    });
    expect(
      screen.getAllByText("Mach den Prompt kürzer. Gib ihn vollständig in einem neuen Codeblock aus.")
    ).toHaveLength(1);
  });

  it("sagt bei 'Auf Englisch' ausdrücklich, dass der Prompt selbst englisch sein soll", async () => {
    vi.stubGlobal("fetch", okFetch("Prompt"));
    render(<Chat initialMessages={withPrompt} initialConversationId="c" />);
    await userEvent.setup().click(screen.getByRole("button", { name: "Auf Englisch" }));

    await waitFor(() => expect(calls()).toHaveLength(1));
    const content: string = sentBody().messages.at(-1).content;
    expect(content).toMatch(/Prompt selbst auf Englisch/);
    expect(content).toMatch(/vollständig in einem neuen Codeblock/);
  });

  it("lässt einen angefangenen Text im Eingabefeld stehen", async () => {
    vi.stubGlobal("fetch", okFetch("Neuer Prompt"));
    render(<Chat initialMessages={withPrompt} initialConversationId="c" />);
    const user = userEvent.setup();
    await user.type(screen.getByRole("textbox"), "Noch etwas dazu");

    await user.click(screen.getByRole("button", { name: "Förmlicher" }));

    await waitFor(() => expect(calls()).toHaveLength(1));
    expect(screen.getByRole("textbox")).toHaveValue("Noch etwas dazu");
  });

  it("'Anderes' schickt nichts und setzt den Cursor ins Eingabefeld", async () => {
    vi.stubGlobal("fetch", okFetch("x"));
    render(<Chat initialMessages={withPrompt} initialConversationId="c" />);
    const user = userEvent.setup();

    await user.click(screen.getByRole("button", { name: "Anderes" }));

    expect(calls()).toHaveLength(0);
    expect(screen.getByRole("textbox")).toHaveFocus();
  });

  it("bietet sie während eines laufenden Zugs nicht an", async () => {
    vi.stubGlobal("fetch", hangingFetch());
    render(<Chat initialMessages={withPrompt} initialConversationId="c" />);
    const user = userEvent.setup();
    expect(screen.getByRole("group", { name: "Prompt anpassen" })).toBeInTheDocument();

    await user.type(screen.getByRole("textbox"), "Mach etwas");
    await user.click(screen.getByRole("button", { name: /Senden/ }));

    await waitFor(() => expect(screen.queryByRole("group", { name: "Prompt anpassen" })).not.toBeInTheDocument());
  });

  it("jede Tippfläche ist mindestens 44 px hoch und mit der Tastatur erreichbar", async () => {
    vi.stubGlobal("fetch", okFetch("x"));
    render(<Chat initialMessages={withPrompt} initialConversationId="c" />);
    const group = screen.getByRole("group", { name: "Prompt anpassen" });
    for (const button of within(group).getAllByRole("button")) {
      expect(button.className).toMatch(/\bmin-h-11\b/);
    }
    const user = userEvent.setup();
    within(group).getByRole("button", { name: "Lockerer" }).focus();
    await user.keyboard("{Enter}");
    await waitFor(() => expect(calls()).toHaveLength(1));
    expect(sentBody().messages.at(-1).content).toMatch(/lockerer/);
  });
});

describe("Antwortvorschläge zu Finns Rückfrage (#225)", () => {
  it("blendet den Block aus, zeigt Tippflächen und hält den Text der Rückfrage", () => {
    render(<Chat initialMessages={withQuestion} initialConversationId="c" />);
    expect(screen.getByText("Wie soll der Brief klingen?")).toBeInTheDocument();
    expect(screen.queryByText(/choices/)).not.toBeInTheDocument();
    expect(screen.queryByText(/sachlich \| freundlich/)).not.toBeInTheDocument();
    const group = screen.getByRole("group", { name: "Antwortvorschläge" });
    expect(within(group).getByRole("group", { name: "Ton?" })).toBeInTheDocument();
    expect(within(group).getByRole("button", { name: "sachlich" })).toBeInTheDocument();
    expect(within(group).getByRole("button", { name: "ausführlich" })).toBeInTheDocument();
  });

  it("nennt eine Rückfrage mit Vorschlägen nicht 'Dein Prompt' und bietet kein Speichern an", () => {
    render(<Chat initialMessages={withQuestion} initialConversationId="c" />);
    expect(screen.queryByText("Dein Prompt")).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Speichern" })).not.toBeInTheDocument();
    expect(screen.queryByRole("group", { name: "Prompt anpassen" })).not.toBeInTheDocument();
  });

  it("fügt einen Tipp ins Eingabefeld ein und schickt nichts ab", async () => {
    vi.stubGlobal("fetch", okFetch("x"));
    render(<Chat initialMessages={withQuestion} initialConversationId="c" />);
    const user = userEvent.setup();

    await user.click(screen.getByRole("button", { name: "freundlich" }));

    expect(screen.getByRole("textbox")).toHaveValue("freundlich");
    expect(calls()).toHaveLength(0);
  });

  it("hängt weitere Tipps mit Komma an und fügt in der Mitte an der Cursor-Stelle ein", async () => {
    render(<Chat initialMessages={withQuestion} initialConversationId="c" />);
    const user = userEvent.setup();
    const box = screen.getByRole("textbox") as HTMLTextAreaElement;

    await user.click(screen.getByRole("button", { name: "sachlich" }));
    await user.click(screen.getByRole("button", { name: "kurz" }));
    expect(box).toHaveValue("sachlich, kurz");

    box.setSelectionRange(0, 0);
    await user.click(screen.getByRole("button", { name: "locker" }));
    expect(box.value.startsWith("locker")).toBe(true);
    expect(box.value).toContain("sachlich, kurz");
  });

  it("blendet die Tippflächen aus, sobald ein Zug läuft", async () => {
    vi.stubGlobal("fetch", hangingFetch());
    render(<Chat initialMessages={withQuestion} initialConversationId="c" />);
    const user = userEvent.setup();
    expect(screen.getByRole("group", { name: "Antwortvorschläge" })).toBeInTheDocument();

    await user.type(screen.getByRole("textbox"), "sachlich");
    await user.click(screen.getByRole("button", { name: /Senden/ }));

    await waitFor(() => expect(screen.queryByRole("group", { name: "Antwortvorschläge" })).not.toBeInTheDocument());
  });

  it("kopiert und exportiert die Antwort ohne den Vorschlags-Block", async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    render(<Chat initialMessages={withQuestion} initialConversationId="c" />);
    const user = userEvent.setup();
    Object.defineProperty(navigator, "clipboard", { value: { writeText }, configurable: true });

    await user.click(screen.getByRole("button", { name: "Antwort kopieren" }));

    expect(writeText).toHaveBeenCalledWith("Wie soll der Brief klingen?");
  });

  it("ohne Block, mit kaputtem Block oder mit nur einer Option bleibt alles wie heute", () => {
    const broken = "```choices\nTon? | nur eine\n```";
    render(
      <Chat
        initialMessages={[withQuestion[0], { id: A1, role: "assistant", content: `Wie soll er klingen?\n\n${broken}` }]}
        initialConversationId="c"
      />
    );
    expect(screen.queryByRole("group", { name: "Antwortvorschläge" })).not.toBeInTheDocument();
    expect(screen.getByText("Ton? | nur eine")).toBeInTheDocument();
  });

  it("bietet die Vorschläge nur an der neuesten Antwort an", () => {
    render(
      <Chat
        initialMessages={[
          ...withQuestion,
          { id: U2, role: "user", content: "freundlich, kurz" },
          { id: A2, role: "assistant", content: `Fertig:\n\n${PROMPT}` },
        ]}
        initialConversationId="c"
      />
    );
    expect(screen.queryByRole("group", { name: "Antwortvorschläge" })).not.toBeInTheDocument();
    expect(screen.queryByText(/Ton\? \|/)).not.toBeInTheDocument();
  });
});
