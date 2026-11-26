import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { SharedPromptCopy } from "./shared-prompt-copy";

// Der Kopieren-Knopf von /geteilt/<token>: ohne ToastProvider steht ein Fehlschlag neben dem Knopf (#421).

const execCommand = vi.fn<(command: string) => boolean>();

beforeEach(() => {
  execCommand.mockReset().mockReturnValue(false);
  Object.defineProperty(document, "execCommand", { configurable: true, value: execCommand });
});
afterEach(() => {
  Reflect.deleteProperty(document, "execCommand");
});

describe("SharedPromptCopy", () => {
  it("kopiert den Prompt und sagt 'Kopiert', ohne Fehlermeldung", async () => {
    const user = userEvent.setup();
    const writeText = vi.spyOn(navigator.clipboard, "writeText").mockResolvedValue(undefined);
    render(<SharedPromptCopy content="Der Prompt" />);

    await user.click(screen.getByRole("button", { name: "Prompt kopieren" }));

    expect(writeText).toHaveBeenCalledWith("Der Prompt");
    expect(await screen.findByRole("button", { name: "Kopiert" })).toBeInTheDocument();
    expect(screen.getByRole("status")).toHaveTextContent("");
  });

  it("sagt neben dem Knopf, dass es nicht ging, statt still zu scheitern", async () => {
    const user = userEvent.setup();
    vi.spyOn(navigator.clipboard, "writeText").mockRejectedValue(new Error("denied"));
    render(<SharedPromptCopy content="Der Prompt" />);

    await user.click(screen.getByRole("button", { name: "Prompt kopieren" }));

    expect(await screen.findByText(/Kopieren ging nicht\. Markiere den Prompt oben/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Prompt kopieren" })).toBeInTheDocument();
  });
});
