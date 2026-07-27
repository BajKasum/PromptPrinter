import { describe, expect, it } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";
import { useSmoothStream } from "./use-smooth-stream";

// jsdom drives requestAnimationFrame on a real timer, so these wait for the
// reveal the same way the UI does rather than stepping frames by hand.
describe("useSmoothStream", () => {
  it("starts empty and reveals the text over time instead of all at once", async () => {
    const { result } = renderHook(() => useSmoothStream("Ein ziemlich langer Prompt-Text."));

    // Nothing is painted on the first frame: the reveal is what makes a
    // provider's burst read as writing rather than as a block.
    expect(result.current.text).toBe("");
    expect(result.current.settled).toBe(false);

    await waitFor(() => expect(result.current.settled).toBe(true));
    expect(result.current.text).toBe("Ein ziemlich langer Prompt-Text.");
  });

  it("keeps revealing when more text arrives after it had already caught up", async () => {
    const { result, rerender } = renderHook(({ text }) => useSmoothStream(text), {
      initialProps: { text: "Erster Teil." },
    });

    await waitFor(() => expect(result.current.settled).toBe(true));

    rerender({ text: "Erster Teil. Und noch ein zweiter Teil." });
    // A grown target immediately counts as unsettled again, which is what
    // stops the caller from committing a reply that is still growing.
    expect(result.current.settled).toBe(false);

    await waitFor(() => expect(result.current.settled).toBe(true));
    expect(result.current.text).toBe("Erster Teil. Und noch ein zweiter Teil.");
  });

  it("only ever emits a prefix of the target, never stale or overrun text", async () => {
    const target = "Vollständiger Prompt.";
    const { result } = renderHook(() => useSmoothStream(target));

    await waitFor(() => expect(result.current.text.length).toBeGreaterThan(0));
    expect(target.startsWith(result.current.text)).toBe(true);

    await waitFor(() => expect(result.current.settled).toBe(true));
    expect(result.current.text).toBe(target);
  });

  it("clamps instead of overrunning when the target is replaced by a shorter one", async () => {
    const { result, rerender } = renderHook(({ text }) => useSmoothStream(text), {
      initialProps: { text: "Eine lange erste Antwort mit viel Text." },
    });

    await waitFor(() => expect(result.current.settled).toBe(true));

    rerender({ text: "Kurz." });
    expect(result.current.text).toBe("Kurz.");
    expect(result.current.settled).toBe(true);
  });
});
