import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ChatComposer } from "./chat-composer";

function setup(overrides: Partial<React.ComponentProps<typeof ChatComposer>> = {}) {
  const onInputChange = vi.fn();
  const onSend = vi.fn();
  const onHandoffSave = vi.fn();
  const onHandoffPacket = vi.fn();
  render(
    <ChatComposer
      input=""
      onInputChange={onInputChange}
      placeholder="Schreib etwas..."
      loading={false}
      onSend={onSend}
      canHandoff={false}
      isWorkspace={false}
      onHandoffSave={onHandoffSave}
      onHandoffPacket={onHandoffPacket}
      {...overrides}
    />
  );
  return { onInputChange, onSend, onHandoffSave, onHandoffPacket };
}

describe("ChatComposer", () => {
  it("disables send while input is empty", () => {
    setup({ input: "" });
    expect(screen.getByRole("button", { name: /Senden/ })).toBeDisabled();
  });

  it("enables send once there is non-whitespace input", () => {
    setup({ input: "hallo" });
    expect(screen.getByRole("button", { name: /Senden/ })).not.toBeDisabled();
  });

  it("keeps send disabled for whitespace-only input", () => {
    setup({ input: "   " });
    expect(screen.getByRole("button", { name: /Senden/ })).toBeDisabled();
  });

  it("disables send while loading even with input present", () => {
    setup({ input: "hallo", loading: true });
    expect(screen.getByRole("button", { name: /Senden/ })).toBeDisabled();
  });

  it("calls onSend when the send button is clicked", async () => {
    const user = userEvent.setup();
    const { onSend } = setup({ input: "hallo" });
    await user.click(screen.getByRole("button", { name: /Senden/ }));
    expect(onSend).toHaveBeenCalledTimes(1);
  });

  it("sends on Enter without Shift", async () => {
    const user = userEvent.setup();
    const { onSend } = setup({ input: "hallo" });
    const textarea = screen.getByPlaceholderText("Schreib etwas...");
    textarea.focus();
    await user.keyboard("{Enter}");
    expect(onSend).toHaveBeenCalledTimes(1);
  });

  it("does not send on Shift+Enter, allowing a newline instead", async () => {
    const user = userEvent.setup();
    const { onSend } = setup({ input: "hallo" });
    const textarea = screen.getByPlaceholderText("Schreib etwas...");
    textarea.focus();
    await user.keyboard("{Shift>}{Enter}{/Shift}");
    expect(onSend).not.toHaveBeenCalled();
  });

  it("forwards typed input via onInputChange", async () => {
    const user = userEvent.setup();
    const { onInputChange } = setup({ input: "" });
    await user.type(screen.getByPlaceholderText("Schreib etwas..."), "x");
    expect(onInputChange).toHaveBeenCalledWith("x");
  });

  it("hides the handoff menu when canHandoff is false", () => {
    setup({ canHandoff: false });
    expect(screen.queryByRole("button", { name: "Nächster Schritt" })).not.toBeInTheDocument();
  });

  it("shows the handoff menu when canHandoff is true", () => {
    setup({ canHandoff: true });
    expect(screen.getByRole("button", { name: "Nächster Schritt" })).toBeInTheDocument();
  });
});
