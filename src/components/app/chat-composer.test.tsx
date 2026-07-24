import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ChatComposer } from "./chat-composer";

function setup(overrides: Partial<React.ComponentProps<typeof ChatComposer>> = {}) {
  const onInputChange = vi.fn();
  const onSend = vi.fn();
  const onStop = vi.fn();
  render(
    <ChatComposer
      input=""
      onInputChange={onInputChange}
      placeholder="Schreib etwas..."
      loading={false}
      onSend={onSend}
      onStop={onStop}
      {...overrides}
    />
  );
  return { onInputChange, onSend, onStop };
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

  it("replaces send with a clickable stop button while loading", () => {
    setup({ input: "hallo", loading: true });
    expect(screen.queryByRole("button", { name: /Senden/ })).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: /stoppen/ })).not.toBeDisabled();
  });

  it("calls onStop when the stop button is clicked", async () => {
    const user = userEvent.setup();
    const { onStop } = setup({ input: "hallo", loading: true });
    await user.click(screen.getByRole("button", { name: /stoppen/ }));
    expect(onStop).toHaveBeenCalledTimes(1);
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
});
