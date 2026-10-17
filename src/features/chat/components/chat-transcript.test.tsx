import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ChatTyping, ChatUserBubble } from "./chat-transcript";

// Planpunkt C-2: die eigene Frage bearbeiten. Der Bearbeiten-Knopf ist bewusst
// ein echter <button> und die Eingabe ein echtes <textarea> — beides muss ohne
// Maus bedienbar sein, und genau das prueft dieser Test mit.

describe("ChatUserBubble", () => {
  it("zeigt die Nachricht und sonst nichts, wenn Bearbeiten nicht erlaubt ist", () => {
    render(<ChatUserBubble content="Meine Frage" />);

    expect(screen.getByText("Meine Frage")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Nachricht bearbeiten" })).not.toBeInTheDocument();
  });

  // Waehrend ein Zug laeuft, reicht chat.tsx kein onEdit durch: die Frage
  // umzuschreiben, auf die gerade geantwortet wird, ergaebe einen Verlauf, der
  // nicht zusammenpasst.
  it("bietet Bearbeiten nur an, wenn ein Handler da ist", () => {
    render(<ChatUserBubble content="Meine Frage" onEdit={vi.fn()} />);
    expect(screen.getByRole("button", { name: "Nachricht bearbeiten" })).toBeInTheDocument();
  });

  it("uebernimmt eine geaenderte Fassung", async () => {
    const onEdit = vi.fn();
    render(<ChatUserBubble content="Alte Frage" onEdit={onEdit} />);
    const user = userEvent.setup();

    await user.click(screen.getByRole("button", { name: "Nachricht bearbeiten" }));
    const field = screen.getByRole("textbox", { name: "Nachricht bearbeiten" });
    await user.clear(field);
    await user.type(field, "Neue Frage");
    await user.click(screen.getByRole("button", { name: "Neu senden" }));

    expect(onEdit).toHaveBeenCalledWith("Neue Frage");
  });

  it("schickt mit Enter ab und bricht mit Escape ab", async () => {
    const onEdit = vi.fn();
    render(<ChatUserBubble content="Alte Frage" onEdit={onEdit} />);
    const user = userEvent.setup();

    await user.click(screen.getByRole("button", { name: "Nachricht bearbeiten" }));
    await user.clear(screen.getByRole("textbox", { name: "Nachricht bearbeiten" }));
    await user.type(screen.getByRole("textbox", { name: "Nachricht bearbeiten" }), "Kurz{Enter}");
    expect(onEdit).toHaveBeenCalledWith("Kurz");

    onEdit.mockClear();
    await user.click(screen.getByRole("button", { name: "Nachricht bearbeiten" }));
    await user.type(screen.getByRole("textbox", { name: "Nachricht bearbeiten" }), "x{Escape}");
    expect(onEdit).not.toHaveBeenCalled();
    expect(screen.getByText("Alte Frage")).toBeInTheDocument();
  });

  // Ein unveraenderter Text waere ein Modellaufruf ohne Gegenwert — genau das,
  // wogegen dieses Produkt antritt.
  it("loest nichts aus, wenn nichts geaendert wurde", async () => {
    const onEdit = vi.fn();
    render(<ChatUserBubble content="Gleich" onEdit={onEdit} />);
    const user = userEvent.setup();

    await user.click(screen.getByRole("button", { name: "Nachricht bearbeiten" }));
    expect(screen.getByRole("button", { name: "Neu senden" })).toBeDisabled();
    await user.keyboard("{Escape}");
    expect(onEdit).not.toHaveBeenCalled();
  });
});

describe("ChatTyping", () => {
  it("zeigt im Normalfall nur, dass Finn schreibt", () => {
    render(<ChatTyping />);

    expect(screen.getByText("Schreibt…")).toBeInTheDocument();
    expect(screen.queryByText(/dauert gerade etwas länger/)).not.toBeInTheDocument();
  });

  // Der Server ist schon beim zweiten Versuch (llm-retry.ts). Ohne diesen
  // Hinweis sähe der Wartepunkt aus wie ein Absturz.
  it("sagt ruhig, dass es länger dauert, solange der Server es nochmal versucht", () => {
    render(<ChatTyping retrying />);

    expect(screen.getByText(/Das dauert gerade etwas länger/)).toBeInTheDocument();
    expect(screen.queryByText("Schreibt…")).not.toBeInTheDocument();
  });

  it("meldet den Hinweis Screenreadern als Status", () => {
    render(<ChatTyping retrying />);

    expect(screen.getByRole("status")).toHaveAccessibleName(/Das dauert gerade etwas länger/);
  });
});

// EU-KI-Verordnung Art. 50 Abs. 2 (Rechts-Audit R-9): eine heruntergeladene Antwort trägt die Markierung.
describe("ChatAssistantBubble: Markdown-Export", () => {
  it("lädt die Antwort mit der KI-Markierung vor dem Text herunter", async () => {
    const downloaded: { name: string; content: string }[] = [];
    vi.resetModules();
    vi.doMock("@/shared/lib/utils", async (importOriginal) => {
      const actual = await importOriginal<typeof import("@/shared/lib/utils")>();
      return { ...actual, downloadFile: (name: string, content: string) => downloaded.push({ name, content }) };
    });
    const { ChatAssistantBubble } = await import("./chat-transcript");
    render(<ChatAssistantBubble content="Du bist ein Tutor." index={0} />);
    const user = userEvent.setup();

    await user.click(screen.getByRole("button", { name: /Export/ }));

    expect(downloaded).toHaveLength(1);
    expect(downloaded[0].name).toBe("prompt-1.md");
    expect(downloaded[0].content.startsWith("<!-- ai-generated: true")).toBe(true);
    expect(downloaded[0].content.endsWith("Du bist ein Tutor.")).toBe(true);
    vi.doUnmock("@/shared/lib/utils");
  });
});
