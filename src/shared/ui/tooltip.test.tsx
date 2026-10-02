import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Tooltip } from "./tooltip";

// Die Pille ist immer im DOM (nur ihre Deckkraft wechselt), deshalb prüfen
// die Tests die Klasse, nicht das Vorhandensein.

function pill() {
  return screen.getByText("Fotos oder Dateien hinzufügen");
}
const visible = () => pill().className.includes("opacity-100");

function setup(align?: "center" | "start") {
  const user = userEvent.setup({ delay: null });
  render(
    <Tooltip label="Fotos oder Dateien hinzufügen" align={align}>
      <button type="button">Plus</button>
    </Tooltip>
  );
  return { user, button: screen.getByRole("button", { name: "Plus" }) };
}

describe("Tooltip", () => {
  // shouldAdvanceTime: Testing Library erkennt Vitests Fake-Timer nicht (es sucht
  // ein `jest`) und wartet in user-event auf einen echten Timer-Tick. Ohne
  // mitlaufende Uhr hängt jede Interaktion bis zum Timeout.
  beforeEach(() => vi.useFakeTimers({ shouldAdvanceTime: true }));
  afterEach(() => vi.useRealTimers());

  it("is hidden at rest", () => {
    setup();
    expect(visible()).toBe(false);
  });

  it("is hidden from assistive technology, the button carries the name itself", () => {
    setup();
    expect(pill()).toHaveAttribute("aria-hidden", "true");
  });

  it("appears after a short hover, not at once", async () => {
    const { user, button } = setup();

    await user.hover(button);
    expect(visible()).toBe(false);

    act(() => vi.advanceTimersByTime(450));
    expect(visible()).toBe(true);
  });

  it("never appears when the pointer only passes through", async () => {
    const { user, button } = setup();

    await user.hover(button);
    act(() => vi.advanceTimersByTime(100));
    await user.unhover(button);
    act(() => vi.advanceTimersByTime(1000));

    expect(visible()).toBe(false);
  });

  it("hides again when the pointer leaves", async () => {
    const { user, button } = setup();
    await user.hover(button);
    act(() => vi.advanceTimersByTime(450));
    expect(visible()).toBe(true);

    await user.unhover(button);

    expect(visible()).toBe(false);
  });

  it("goes away on click, so it does not hang around behind the file dialog", async () => {
    const { user, button } = setup();
    await user.hover(button);
    act(() => vi.advanceTimersByTime(450));

    await user.click(button);

    expect(visible()).toBe(false);
  });

  it("appears at once for keyboard focus and closes on Escape", async () => {
    const { user } = setup();

    await user.tab();
    expect(visible()).toBe(true);

    await user.keyboard("{Escape}");
    expect(visible()).toBe(false);
  });

  it("hides when focus leaves", async () => {
    const { user } = setup();
    await user.tab();
    expect(visible()).toBe(true);

    await user.tab();

    expect(visible()).toBe(false);
  });

  it("sits flush left when asked to, so a button at the edge does not push it off screen", () => {
    setup("start");
    expect(pill().className).toContain("left-0");
    expect(pill().className).not.toContain("-translate-x-1/2");
  });

  it("is centred under its trigger by default", () => {
    setup();
    expect(pill().className).toContain("-translate-x-1/2");
  });
});
