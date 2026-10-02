import { afterEach, describe, expect, it, vi } from "vitest";
import { render, screen, act, fireEvent } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ChatComposer } from "./chat-composer";
import { MAX_ATTACHMENTS_PER_MESSAGE, MAX_USER_MESSAGE_CHARS } from "@/shared/lib/chat-limits";
import type { DraftAttachment } from "@/features/chat/lib/prepare-attachment";

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
  // EU AI Act Art. 50(1): users must learn they are talking to an AI no later
  // than the first interaction, so the notice has to be there before anything
  // is typed, not only after a reply.
  it("gives the message field an accessible name beyond its placeholder", () => {
    setup();
    expect(screen.getByRole("textbox", { name: "Nachricht an Finn" })).toBeInTheDocument();
  });

  it("tells the user up front that Finn is an AI", () => {
    setup();
    expect(screen.getByText(/Finn ist eine KI/)).toBeInTheDocument();
  });

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

// Fotos und Dateien hinzufügen (2026-10-02): ein "+" links im Composer, direkt
// zur Dateiauswahl, kein Menü. Die Tests prüfen, was der Nutzer sieht und was
// beim Composer ankommt: der Rest (Aufbereiten, Limits) gehört dem Hook.
describe("ChatComposer, attachments", () => {
  const draft = (id: string, name = `${id}.md`, kind: "image" | "text" = "text"): DraftAttachment => ({
    id,
    name,
    kind,
    mediaType: kind === "image" ? "image/png" : "text/plain",
    sizeBytes: 1024,
    data: "QUJD",
    ...(kind === "image" ? { previewUrl: "data:image/png;base64,QUJD" } : {}),
  });

  function setupAttach(overrides: Partial<React.ComponentProps<typeof ChatComposer>> = {}) {
    const onAddFiles = vi.fn();
    const onRemoveAttachment = vi.fn();
    const utils = setup({ onAddFiles, onRemoveAttachment, ...overrides });
    return { onAddFiles, onRemoveAttachment, ...utils };
  }

  it("offers no plus button where attachments are not wired up", () => {
    setup();
    expect(screen.queryByRole("button", { name: "Fotos oder Dateien hinzufügen" })).not.toBeInTheDocument();
    expect(screen.queryByTestId("attachment-input")).not.toBeInTheDocument();
  });

  it("offers a plus button named after what it does", () => {
    setupAttach();
    expect(screen.getByRole("button", { name: "Fotos oder Dateien hinzufügen" })).toBeEnabled();
  });

  it("also shows that name as a tooltip", () => {
    setupAttach();
    // Das Tooltip ist aria-hidden, der Knopf trägt den Namen selbst.
    expect(screen.getByText("Fotos oder Dateien hinzufügen")).toHaveAttribute("aria-hidden", "true");
  });

  it("opens the file dialog directly when the plus is pressed", async () => {
    const user = userEvent.setup();
    setupAttach();
    const input = screen.getByTestId("attachment-input") as HTMLInputElement;
    const click = vi.spyOn(input, "click");

    await user.click(screen.getByRole("button", { name: "Fotos oder Dateien hinzufügen" }));

    expect(click).toHaveBeenCalledTimes(1);
  });

  it("lets the dialog pick several files, photos and documents", () => {
    setupAttach();
    const input = screen.getByTestId("attachment-input");
    expect(input).toHaveAttribute("type", "file");
    expect(input).toHaveAttribute("multiple");
    const accept = input.getAttribute("accept") ?? "";
    expect(accept).toContain(".png");
    expect(accept).toContain("image/webp");
    expect(accept).toContain(".md");
  });

  it("hands the chosen files over, and forgets them so the same file can be picked again", async () => {
    const user = userEvent.setup();
    const { onAddFiles } = setupAttach();
    const file = new File(["# Hi"], "notes.md", { type: "text/markdown" });
    const input = screen.getByTestId("attachment-input") as HTMLInputElement;

    await user.upload(input, file);

    expect(onAddFiles).toHaveBeenCalledWith([file]);
    expect(input.value).toBe("");
  });

  it("does not call onAddFiles when the dialog is cancelled", () => {
    const { onAddFiles } = setupAttach();
    fireEvent.change(screen.getByTestId("attachment-input"), { target: { files: [] } });
    expect(onAddFiles).not.toHaveBeenCalled();
  });

  it("adds files pasted from the clipboard, and keeps the paste from also inserting text", () => {
    const { onAddFiles } = setupAttach();
    const shot = new File(["x"], "screen.png", { type: "image/png" });

    const notPrevented = fireEvent.paste(screen.getByRole("textbox"), {
      clipboardData: { files: [shot], getData: () => "" },
    });

    expect(onAddFiles).toHaveBeenCalledWith([shot]);
    expect(notPrevented).toBe(false);
  });

  it("leaves an ordinary text paste alone", () => {
    const { onAddFiles } = setupAttach();

    const notPrevented = fireEvent.paste(screen.getByRole("textbox"), {
      clipboardData: { files: [], getData: () => "nur Text" },
    });

    expect(onAddFiles).not.toHaveBeenCalled();
    expect(notPrevented).toBe(true);
  });

  it("shows the waiting attachments above the text field", () => {
    setupAttach({ attachments: [draft("a", "screen.png", "image"), draft("b", "notes.md")] });
    expect(screen.getByRole("list", { name: "Anhänge" })).toBeInTheDocument();
    expect(screen.getByRole("img", { name: "screen.png" })).toBeInTheDocument();
    expect(screen.getByText("notes.md")).toBeInTheDocument();
  });

  it("removes one attachment by its own button", async () => {
    const user = userEvent.setup();
    const { onRemoveAttachment } = setupAttach({ attachments: [draft("a"), draft("b")] });

    await user.click(screen.getByRole("button", { name: "„b.md“ entfernen" }));

    expect(onRemoveAttachment).toHaveBeenCalledWith("b");
  });

  it("disables the plus at the limit and says why in the tooltip", () => {
    setupAttach({
      attachments: Array.from({ length: MAX_ATTACHMENTS_PER_MESSAGE }, (_, i) => draft(`f${i}`)),
    });
    expect(screen.getByRole("button", { name: "Fotos oder Dateien hinzufügen" })).toBeDisabled();
    expect(
      screen.getByText(`Höchstens ${MAX_ATTACHMENTS_PER_MESSAGE} Anhänge pro Nachricht`)
    ).toBeInTheDocument();
  });

  it("counts files still being prepared against the limit", () => {
    setupAttach({ attachments: [draft("a")], attachPending: MAX_ATTACHMENTS_PER_MESSAGE - 1 });
    expect(screen.getByRole("button", { name: "Fotos oder Dateien hinzufügen" })).toBeDisabled();
  });

  it("tells the user what is missing when files are attached but there is no text", () => {
    setupAttach({ attachments: [draft("a")], input: "" });
    expect(screen.getByText("Schreib noch kurz dazu, was ich damit tun soll.")).toBeInTheDocument();
  });

  it("drops that hint once there is text", () => {
    setupAttach({ attachments: [draft("a")], input: "Bau das nach" });
    expect(
      screen.queryByText("Schreib noch kurz dazu, was ich damit tun soll.")
    ).not.toBeInTheDocument();
  });

  it("keeps send disabled for files without text", () => {
    setupAttach({ attachments: [draft("a")], input: "" });
    expect(screen.getByRole("button", { name: /Senden/ })).toBeDisabled();
  });

  it("keeps send disabled while a file is still being prepared", () => {
    setupAttach({ input: "Bau das nach", attachPending: 1 });
    expect(screen.getByRole("button", { name: /Senden/ })).toBeDisabled();
  });

  it("leaves room for the plus button in front of the text", () => {
    setupAttach();
    expect(screen.getByRole("textbox").className).toContain("pl-[3.25rem]");
  });
});
