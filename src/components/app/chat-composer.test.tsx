import { afterEach, describe, expect, it, vi } from "vitest";
import { render, screen, act } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ChatComposer } from "./chat-composer";
import { MAX_USER_MESSAGE_CHARS } from "@/lib/chat-limits";

function setup(overrides: Partial<React.ComponentProps<typeof ChatComposer>> = {}) {
  const onInputChange = vi.fn();
  const onSend = vi.fn();
  const onStop = vi.fn();
  const utils = render(
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
  return { onInputChange, onSend, onStop, ...utils };
}

// jsdom doesn't implement the VisualViewport API (window.visualViewport is
// undefined by default), so the "keyboard open" tests below stub a minimal
// EventTarget-based fake and swap it in.
class FakeVisualViewport extends EventTarget {
  height: number;
  offsetTop: number;
  constructor(height: number, offsetTop = 0) {
    super();
    this.height = height;
    this.offsetTop = offsetTop;
  }
  resize(height: number, offsetTop = 0) {
    this.height = height;
    this.offsetTop = offsetTop;
    this.dispatchEvent(new Event("resize"));
  }
}

describe("ChatComposer", () => {
  // QA finding F-2/E-1: the server rejects anything past this, and pasting a
  // long spec or log is exactly what this audience does. Without the cap that
  // came back as a bare "Invalid request".
  describe("length cap", () => {
    it("caps the textarea at the ceiling the server enforces", () => {
      setup({ input: "" });
      expect(screen.getByRole("textbox")).toHaveAttribute(
        "maxlength",
        String(MAX_USER_MESSAGE_CHARS)
      );
    });

    it("stays quiet while the limit is nowhere near", () => {
      setup({ input: "kurz" });
      expect(screen.queryByText(/noch \d+ Zeichen/)).not.toBeInTheDocument();
    });

    it("counts down once the input gets close to the limit", () => {
      setup({ input: "x".repeat(MAX_USER_MESSAGE_CHARS - 40) });
      expect(screen.getByText("noch 40 Zeichen")).toBeInTheDocument();
    });

    it("says so plainly at the limit instead of showing zero", () => {
      setup({ input: "x".repeat(MAX_USER_MESSAGE_CHARS) });
      expect(screen.getByText("Maximale Länge erreicht")).toBeInTheDocument();
    });
  });

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

  // QA finding K-1: `sticky bottom-0` alone leaves the composer stranded
  // behind (or floating above) an iOS on-screen keyboard, since it only
  // reacts to the layout viewport, not the visual one the keyboard shrinks.
  // The composer's own wrapper gets an inline `bottom` push once
  // useVisualViewportInset reports a non-zero inset.
  describe("keyboard inset (QA finding K-1)", () => {
    const originalVisualViewport = window.visualViewport;
    const originalInnerHeight = window.innerHeight;

    afterEach(() => {
      Object.defineProperty(window, "visualViewport", {
        value: originalVisualViewport,
        configurable: true,
      });
      Object.defineProperty(window, "innerHeight", {
        value: originalInnerHeight,
        configurable: true,
      });
    });

    function stickyWrapper(container: HTMLElement) {
      return container.querySelector(".sticky") as HTMLElement | null;
    }

    it("applies no bottom offset when no keyboard is open", () => {
      Object.defineProperty(window, "innerHeight", { value: 800, configurable: true });
      Object.defineProperty(window, "visualViewport", {
        value: new FakeVisualViewport(800),
        configurable: true,
      });
      const { container } = setup();
      expect(stickyWrapper(container)?.style.bottom).toBe("");
    });

    it("pushes the composer up by exactly the keyboard's height once the visual viewport shrinks", () => {
      Object.defineProperty(window, "innerHeight", { value: 800, configurable: true });
      const vv = new FakeVisualViewport(800);
      Object.defineProperty(window, "visualViewport", { value: vv, configurable: true });
      const { container } = setup();

      act(() => vv.resize(500));

      expect(stickyWrapper(container)?.style.bottom).toBe("300px");
    });

    it("returns to no offset once the keyboard closes again", () => {
      Object.defineProperty(window, "innerHeight", { value: 800, configurable: true });
      const vv = new FakeVisualViewport(800);
      Object.defineProperty(window, "visualViewport", { value: vv, configurable: true });
      const { container } = setup();

      act(() => vv.resize(500));
      expect(stickyWrapper(container)?.style.bottom).toBe("300px");
      act(() => vv.resize(800));
      expect(stickyWrapper(container)?.style.bottom).toBe("");
    });
  });
});
