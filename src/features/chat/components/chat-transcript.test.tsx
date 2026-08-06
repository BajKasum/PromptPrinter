import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ChatUserBubble } from "./chat-transcript";

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
