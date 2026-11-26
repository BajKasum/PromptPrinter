import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { PlaceholderForm } from "./placeholder-form";
import { ToastContext } from "@/shared/ui/toast-context";
import { de } from "@/shared/i18n/messages/de";

// Das Ausfüllformular steht im Chat, an gespeicherten Prompts und auf /geteilt/<token> (dort ohne Toast): ein
// Fehlschlag beim Kopieren steht deshalb im Formular selbst (#421), nie doppelt auch als Toast.

const execCommand = vi.fn<(command: string) => boolean>();
const toast = vi.fn();

beforeEach(() => {
  toast.mockReset();
  execCommand.mockReset().mockReturnValue(false);
  Object.defineProperty(document, "execCommand", { configurable: true, value: execCommand });
});
afterEach(() => {
  Reflect.deleteProperty(document, "execCommand");
});

async function copyFilled() {
  const user = userEvent.setup();
  const writeText = vi.spyOn(navigator.clipboard, "writeText");
  render(
    <ToastContext.Provider value={{ toast }}>
      <PlaceholderForm prompt="Schreib an [Name]." />
    </ToastContext.Provider>
  );
  await user.click(screen.getByRole("button", { name: /Platzhalter/ }));
  await user.type(screen.getByLabelText("Name"), "Anna");
  return { user, writeText };
}

describe("PlaceholderForm: Kopieren", () => {
  it("kopiert die ausgefüllte Fassung", async () => {
    const { user, writeText } = await copyFilled();

    await user.click(screen.getByRole("button", { name: de.chat.fill.copy }));

    expect(writeText).toHaveBeenCalledWith("Schreib an Anna.");
    expect(await screen.findByRole("button", { name: de.common.copied })).toBeInTheDocument();
    expect(screen.getByRole("status")).toHaveTextContent("");
  });

  it("sagt im Formular, dass es nicht ging, und meldet nicht doppelt", async () => {
    const { user, writeText } = await copyFilled();
    writeText.mockRejectedValue(new Error("denied"));

    await user.click(screen.getByRole("button", { name: de.chat.fill.copy }));

    expect(await screen.findByText(`${de.common.copyFailed}. ${de.common.copyFailedHint}`)).toBeInTheDocument();
    expect(toast).not.toHaveBeenCalled();
  });
});
