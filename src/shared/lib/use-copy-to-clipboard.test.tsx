import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, renderHook } from "@testing-library/react";
import type { ReactNode } from "react";
import { useCopyToClipboard } from "./use-copy-to-clipboard";
import { ToastContext } from "@/shared/ui/toast-context";
import { de } from "@/shared/i18n/messages/de";

// #421: der Hook fing eine Ablehnung der Zwischenablage nicht ab, und per http fehlt `navigator.clipboard` ganz.

const writeText = vi.fn<(text: string) => Promise<void>>();
const execCommand = vi.fn<(command: string) => boolean>();
const toast = vi.fn();

function setClipboard(value: unknown) {
  Object.defineProperty(navigator, "clipboard", { configurable: true, value });
}

const withToasts = ({ children }: { children: ReactNode }) => (
  <ToastContext.Provider value={{ toast }}>{children}</ToastContext.Provider>
);

beforeEach(() => {
  writeText.mockReset().mockResolvedValue(undefined);
  execCommand.mockReset().mockReturnValue(true);
  toast.mockReset();
  setClipboard({ writeText });
  Object.defineProperty(document, "execCommand", { configurable: true, value: execCommand });
});

afterEach(() => {
  vi.useRealTimers();
  Reflect.deleteProperty(navigator, "clipboard");
  Reflect.deleteProperty(document, "execCommand");
  document.body.innerHTML = "";
});

function setup(delay?: number) {
  return renderHook(() => useCopyToClipboard(delay), { wrapper: withToasts });
}

async function copy(view: ReturnType<typeof setup>, text = "Text", options?: { quiet?: boolean }) {
  let ok: boolean | undefined;
  await act(async () => {
    ok = await view.result.current.copy(text, options);
  });
  return ok;
}

describe("useCopyToClipboard: Kopieren", () => {
  it("legt den Text über die Clipboard-API ab, ohne Auswahl, ohne Meldung", async () => {
    const view = setup();

    expect(await copy(view, "hallo")).toBe(true);

    expect(writeText).toHaveBeenCalledWith("hallo");
    expect(execCommand).not.toHaveBeenCalled();
    expect(view.result.current.copied).toBe(true);
    expect(view.result.current.failed).toBe(false);
    expect(view.result.current.copyCount).toBe(1);
    expect(toast).not.toHaveBeenCalled();
  });

  it.each([
    ["der Browser lehnt ab", () => writeText.mockRejectedValue(new DOMException("denied", "NotAllowedError"))],
    ["navigator.clipboard fehlt (per http)", () => setClipboard(undefined)],
  ])("nimmt den Weg über eine Auswahl, wenn %s", async (_name, arrange) => {
    arrange();
    const button = document.body.appendChild(document.createElement("button"));
    button.focus();
    const selected: string[] = [];
    execCommand.mockImplementation((command) => {
      const field = document.activeElement as HTMLTextAreaElement;
      selected.push(command, field.value.slice(field.selectionStart, field.selectionEnd));
      return true;
    });
    const view = setup();

    expect(await copy(view, "Zeile 1\nZeile 2")).toBe(true);

    expect(selected).toEqual(["copy", "Zeile 1\nZeile 2"]);
    expect(view.result.current.copied).toBe(true);
    expect(toast).not.toHaveBeenCalled();
    // Das Hilfsfeld verschwindet wieder, und der Fokus bleibt, wo er war.
    expect(document.querySelector("textarea")).toBeNull();
    expect(document.activeElement).toBe(button);
  });

  it.each([
    ["die Auswahl ablehnt", () => execCommand.mockReturnValue(false)],
    [
      "die Auswahl wirft",
      () =>
        execCommand.mockImplementation(() => {
          throw new Error("kaputt");
        }),
    ],
    ["es execCommand nicht gibt", () => Reflect.deleteProperty(document, "execCommand")],
  ])("meldet den Fehlschlag, wenn auch %s", async (_name, arrange) => {
    writeText.mockRejectedValue(new Error("denied"));
    arrange();
    const view = setup();

    expect(await copy(view)).toBe(false);

    expect(view.result.current.copied).toBe(false);
    expect(view.result.current.failed).toBe(true);
    expect(view.result.current.copyCount).toBe(0);
    expect(toast).toHaveBeenCalledTimes(1);
    expect(toast).toHaveBeenCalledWith({
      title: de.common.copyFailed,
      description: de.common.copyFailedHint,
      variant: "error",
    });
    expect(document.querySelector("textarea")).toBeNull();
  });

  it("bleibt mit quiet still, sagt den Fehlschlag aber über failed", async () => {
    writeText.mockRejectedValue(new Error("denied"));
    execCommand.mockReturnValue(false);
    const view = setup();

    expect(await copy(view, "x", { quiet: true })).toBe(false);

    expect(view.result.current.failed).toBe(true);
    expect(toast).not.toHaveBeenCalled();
  });

  it("läuft ohne ToastProvider, ohne zu werfen (öffentliche Seiten)", async () => {
    writeText.mockRejectedValue(new Error("denied"));
    execCommand.mockReturnValue(false);
    const view = renderHook(() => useCopyToClipboard());

    await act(async () => {
      expect(await view.result.current.copy("x")).toBe(false);
    });

    expect(view.result.current.failed).toBe(true);
  });

  it("nimmt den Fehlschlag beim nächsten Versuch zurück", async () => {
    writeText.mockRejectedValueOnce(new Error("denied"));
    execCommand.mockReturnValue(false);
    const view = setup();
    await copy(view);

    await copy(view);

    expect(view.result.current.failed).toBe(false);
    expect(view.result.current.copied).toBe(true);
  });

  it("nimmt ein 'Kopiert' sofort weg, wenn der nächste Versuch scheitert", async () => {
    const view = setup();
    await copy(view);
    writeText.mockRejectedValue(new Error("denied"));
    execCommand.mockReturnValue(false);

    await copy(view);

    expect(view.result.current.copied).toBe(false);
  });
});

describe("useCopyToClipboard: Timer", () => {
  it("nimmt 'Kopiert' nach der Frist zurück", async () => {
    vi.useFakeTimers();
    const view = setup(1000);
    await copy(view);

    act(() => void vi.advanceTimersByTime(999));
    expect(view.result.current.copied).toBe(true);
    act(() => void vi.advanceTimersByTime(1));
    expect(view.result.current.copied).toBe(false);
  });

  it("beginnt die Frist bei jedem Klick neu, der Timer des ersten stört nicht", async () => {
    vi.useFakeTimers();
    const view = setup(1000);
    await copy(view);
    act(() => void vi.advanceTimersByTime(600));

    await copy(view);
    act(() => void vi.advanceTimersByTime(600));

    expect(view.result.current.copied).toBe(true);
    expect(view.result.current.copyCount).toBe(2);
    act(() => void vi.advanceTimersByTime(400));
    expect(view.result.current.copied).toBe(false);
  });

  it("räumt den Timer beim Aushängen weg", async () => {
    vi.useFakeTimers();
    const view = setup(1000);
    await copy(view);
    expect(vi.getTimerCount()).toBe(1);

    view.unmount();

    expect(vi.getTimerCount()).toBe(0);
  });

  it("startet keinen Timer mehr, wenn die Zwischenablage erst nach dem Aushängen antwortet", async () => {
    vi.useFakeTimers();
    let finish!: () => void;
    writeText.mockReturnValue(new Promise<void>((resolve) => (finish = resolve)));
    const view = setup(1000);
    let pending!: Promise<boolean>;
    act(() => {
      pending = view.result.current.copy("x");
    });
    view.unmount();

    finish();
    await expect(pending).resolves.toBe(true);

    expect(vi.getTimerCount()).toBe(0);
  });
});
