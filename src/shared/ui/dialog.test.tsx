import { useRef, useState } from "react";
import { describe, expect, it, vi } from "vitest";
import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Dialog, isModalOpen, useModal } from "./dialog";

// #368: die Tastatur-Seite von `aria-modal`. Tab bleibt im Dialog, Escape meldet sich beim obersten Fenster, und der
// Fokus kehrt beim Schliessen zum Auslöser zurück.

type HarnessProps = {
  onClose?: () => void;
  returnFocus?: () => boolean;
  /** Der Fokus soll beim Öffnen auf den zweiten Knopf statt auf das erste Element. */
  startOnSecond?: boolean;
  disableSecond?: boolean;
};

function Harness({ onClose, returnFocus, startOnSecond, disableSecond }: HarnessProps) {
  const [open, setOpen] = useState(false);
  const secondRef = useRef<HTMLButtonElement>(null);
  return (
    <>
      <button onClick={() => setOpen(true)}>Auslöser</button>
      <button>Dahinter</button>
      <Dialog
        open={open}
        label="Prüfung"
        onClose={() => {
          onClose?.();
          setOpen(false);
        }}
        initialFocusRef={startOnSecond ? secondRef : undefined}
        returnFocus={returnFocus}
      >
        <input aria-label="Erstes" />
        <button ref={secondRef} disabled={disableSecond}>
          Zweites
        </button>
        <button tabIndex={-1}>Ausgenommen</button>
        <button>Letztes</button>
      </Dialog>
    </>
  );
}

const field = () => screen.getByRole("textbox", { name: "Erstes" });
const button = (name: string) => screen.getByRole("button", { name });
const trigger = () => button("Auslöser");

async function open(props: HarnessProps = {}) {
  const user = userEvent.setup();
  const view = render(<Harness {...props} />);
  await user.click(trigger());
  // Der Fokus kommt erst einen Moment nach dem Öffnen. Eine Taste davor ginge noch an den Auslöser.
  const target = props.startOnSecond && !props.disableSecond ? button("Zweites") : field();
  await waitFor(() => expect(target).toHaveFocus());
  return { user, ...view };
}

describe("Dialog: Gerüst", () => {
  it("hängt benannt und modal an document.body", async () => {
    const { container } = await open();
    const dialog = screen.getByRole("dialog", { name: "Prüfung" });
    expect(dialog).toHaveAttribute("aria-modal", "true");
    expect(container.contains(dialog)).toBe(false);
  });

  it("schliesst bei einem Klick daneben und nimmt dem Browser die Fokus-Änderung ab", async () => {
    const onClose = vi.fn();
    await open({ onClose });
    const backdrop = screen.getByRole("dialog").parentElement as HTMLElement;

    // `false`: preventDefault. Sonst setzt der Browser den Fokus nach dem Zurückgeben auf <body>.
    expect(fireEvent.mouseDown(backdrop)).toBe(false);
    expect(onClose).toHaveBeenCalledTimes(1);
    await waitFor(() => expect(trigger()).toHaveFocus());
  });

  it("bleibt bei einem Klick in den Dialog offen", async () => {
    const onClose = vi.fn();
    await open({ onClose });
    expect(fireEvent.mouseDown(screen.getByRole("dialog"))).toBe(true);
    expect(onClose).not.toHaveBeenCalled();
  });
});

describe("Dialog: Fokus beim Öffnen", () => {
  it("geht auf das gewünschte Element", async () => {
    await open({ startOnSecond: true });
    expect(button("Zweites")).toHaveFocus();
  });

  it("geht auf den Dialog selbst, wenn das Ziel gesperrt ist", async () => {
    const user = userEvent.setup();
    render(<Harness startOnSecond disableSecond />);
    await user.click(trigger());
    await waitFor(() => expect(screen.getByRole("dialog")).toHaveFocus());
  });
});

describe("Dialog: Tab bleibt drinnen", () => {
  it("springt vom letzten Element auf das erste", async () => {
    const { user } = await open();
    await user.tab();
    await user.tab();
    expect(button("Letztes")).toHaveFocus();
    await user.tab();
    expect(field()).toHaveFocus();
  });

  it("springt mit Shift+Tab vom ersten Element auf das letzte", async () => {
    const { user } = await open();
    await user.tab({ shift: true });
    expect(button("Letztes")).toHaveFocus();
  });

  it("holt den Fokus von ausserhalb zurück, vorwärts auf das erste, rückwärts auf das letzte", async () => {
    const { user } = await open();
    act(() => button("Dahinter").focus());
    await user.tab();
    expect(field()).toHaveFocus();

    act(() => (document.activeElement as HTMLElement).blur());
    expect(document.body).toHaveFocus();
    await user.tab({ shift: true });
    expect(button("Letztes")).toHaveFocus();
  });

  it("geht vom Dialog selbst auf das erste oder letzte Element", async () => {
    const { user } = await open();
    act(() => screen.getByRole("dialog").focus());
    await user.tab({ shift: true });
    expect(button("Letztes")).toHaveFocus();
  });

  it.each([
    ["vorwärts", false, "Letztes"],
    ["rückwärts", true, "Erstes"],
  ])("geht von einem inzwischen gesperrten Knopf %s weiter", async (_direction, shiftKey, next) => {
    const { rerender } = await open({ startOnSecond: true });
    rerender(<Harness startOnSecond disableSecond />);
    // Der gesperrte Knopf hält den Fokus noch. `userEvent` stellte das als <body> dar, deshalb das rohe Ereignis.
    expect(button("Zweites")).toHaveFocus();

    expect(fireEvent.keyDown(button("Zweites"), { key: "Tab", shiftKey })).toBe(false);
    expect(next === "Erstes" ? field() : button(next)).toHaveFocus();
  });

  it("hält den Fokus auf dem Dialog, wenn nichts erreichbar ist", async () => {
    const user = userEvent.setup();
    render(
      <Dialog open label="Leer" onClose={() => {}}>
        <button disabled>Gesperrt</button>
      </Dialog>
    );
    await waitFor(() => expect(screen.getByRole("dialog")).toHaveFocus());
    await user.tab();
    expect(screen.getByRole("dialog")).toHaveFocus();
  });
});

describe("Dialog: Escape und Rückgabe", () => {
  it("schliesst mit Escape und gibt den Fokus an den Auslöser zurück", async () => {
    const onClose = vi.fn();
    const { user } = await open({ onClose });
    await user.keyboard("{Escape}");
    expect(onClose).toHaveBeenCalledTimes(1);
    await waitFor(() => expect(trigger()).toHaveFocus());
  });

  it("lässt das Escape einer Eingabehilfe in Ruhe", async () => {
    const onClose = vi.fn();
    await open({ onClose });
    fireEvent.keyDown(field(), { key: "Escape", isComposing: true });
    expect(onClose).not.toHaveBeenCalled();
  });

  it("gibt den Fokus nicht zurück, wenn der Aufrufer es ablehnt", async () => {
    const { user } = await open({ returnFocus: () => false });
    await user.keyboard("{Escape}");
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
    expect(trigger()).not.toHaveFocus();
  });

  it("nimmt den Fokus niemandem weg, dem ihn inzwischen jemand gegeben hat", async () => {
    await open();
    act(() => {
      button("Dahinter").focus();
      fireEvent.mouseDown(screen.getByRole("dialog").parentElement as HTMLElement);
    });
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
    expect(button("Dahinter")).toHaveFocus();
  });

  it("gibt den Fokus auch zurück, wenn der Dialog samt Inhalt abgebaut wird", async () => {
    const outside = document.body.appendChild(document.createElement("button"));
    outside.focus();
    const { unmount } = render(
      <Dialog open label="Kurz" onClose={() => {}}>
        <button>Drin</button>
      </Dialog>
    );
    await waitFor(() => expect(button("Drin")).toHaveFocus());
    unmount();
    expect(outside).toHaveFocus();
    outside.remove();
  });
});

// Zwei Fenster übereinander, wie "Neues Projekt" aus dem Drawer der Mobile-Navigation.
function Stacked({ onOuter, onInner }: { onOuter: () => void; onInner: () => void }) {
  const [inner, setInner] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useModal({ open: true, containerRef: ref, onClose: onOuter });
  return (
    <>
      <div ref={ref} tabIndex={-1}>
        <button onClick={() => setInner(true)}>Darüber öffnen</button>
        <button>Unten</button>
      </div>
      <Dialog
        open={inner}
        label="Oben"
        onClose={() => {
          onInner();
          setInner(false);
        }}
      >
        <button>Oben eins</button>
        <button>Oben zwei</button>
      </Dialog>
    </>
  );
}

describe("Dialog: übereinander", () => {
  it("Tab und Escape gelten nur dem obersten, danach wieder dem darunter", async () => {
    const onOuter = vi.fn();
    const onInner = vi.fn();
    const user = userEvent.setup();
    render(<Stacked onOuter={onOuter} onInner={onInner} />);
    await waitFor(() => expect(button("Darüber öffnen")).toHaveFocus());

    await user.click(button("Darüber öffnen"));
    await waitFor(() => expect(button("Oben eins")).toHaveFocus());
    await user.tab();
    await user.tab();
    expect(button("Oben eins")).toHaveFocus();

    await user.keyboard("{Escape}");
    expect(onInner).toHaveBeenCalledTimes(1);
    expect(onOuter).not.toHaveBeenCalled();
    await waitFor(() => expect(button("Darüber öffnen")).toHaveFocus());

    await user.keyboard("{Escape}");
    expect(onOuter).toHaveBeenCalledTimes(1);
  });

  it("isModalOpen stimmt, solange ein Fenster offen ist", async () => {
    expect(isModalOpen()).toBe(false);
    const { user, unmount } = await open();
    expect(isModalOpen()).toBe(true);
    await user.keyboard("{Escape}");
    expect(isModalOpen()).toBe(false);
    unmount();
  });
});
