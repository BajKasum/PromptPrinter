import { afterEach, describe, expect, it, vi } from "vitest";
import { act, renderHook } from "@testing-library/react";

// TURNSTILE_SITE_KEY liest die Umgebung beim Laden des Moduls: jeder Fall mit eigenem Wert lädt frisch.
async function load(siteKey: string) {
  vi.resetModules();
  vi.stubEnv("NEXT_PUBLIC_TURNSTILE_SITE_KEY", siteKey);
  return import("./use-turnstile");
}

describe("useTurnstile", () => {
  afterEach(() => vi.unstubAllEnvs());

  it("hält das gemeldete Token und verlangt keines mehr", async () => {
    const { useTurnstile } = await load("site-key");
    const { result } = renderHook(() => useTurnstile());
    expect(result.current.token).toBeNull();
    expect(result.current.missing).toBe(true);

    act(() => result.current.widgetProps.onToken("token-1"));

    expect(result.current.token).toBe("token-1");
    expect(result.current.missing).toBe(false);
  });

  it("verwirft das Token bei refresh() und fordert mit jedem Aufruf ein neues an", async () => {
    const { useTurnstile } = await load("site-key");
    const { result } = renderHook(() => useTurnstile());
    act(() => result.current.widgetProps.onToken("token-1"));
    expect(result.current.widgetProps.resetSignal).toBe(0);

    act(() => result.current.refresh());
    expect(result.current.token).toBeNull();
    expect(result.current.missing).toBe(true);
    expect(result.current.widgetProps.resetSignal).toBe(1);

    act(() => result.current.refresh());
    expect(result.current.widgetProps.resetSignal).toBe(2);
  });

  it("gibt dem Widget über jeden Durchlauf dieselbe Funktion, sonst montierte es neu", async () => {
    const { useTurnstile } = await load("site-key");
    const { result } = renderHook(() => useTurnstile());
    const { onToken } = result.current.widgetProps;
    const { refresh } = result.current;
    act(() => result.current.widgetProps.onToken("token-1"));
    act(() => result.current.refresh());
    expect(result.current.widgetProps.onToken).toBe(onToken);
    expect(result.current.refresh).toBe(refresh);
  });

  it("verlangt ohne Site-Key kein Token", async () => {
    const { useTurnstile } = await load("");
    const { result } = renderHook(() => useTurnstile());
    expect(result.current.missing).toBe(false);
  });
});
