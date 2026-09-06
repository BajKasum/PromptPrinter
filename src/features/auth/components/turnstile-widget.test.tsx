import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, render, screen, waitFor } from "@testing-library/react";

const SCRIPT_SRC = "https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit";

// TURNSTILE_SITE_KEY is read from process.env at module load time, so every
// test that needs a specific value must reset the module registry and
// re-import fresh — vi.stubEnv alone would arrive too late.
async function importWidget(siteKey: string | undefined) {
  vi.resetModules();
  if (siteKey === undefined) vi.stubEnv("NEXT_PUBLIC_TURNSTILE_SITE_KEY", "");
  else vi.stubEnv("NEXT_PUBLIC_TURNSTILE_SITE_KEY", siteKey);
  return import("./turnstile-widget");
}

function scriptTag(): HTMLScriptElement | null {
  return document.querySelector<HTMLScriptElement>(`script[src="${SCRIPT_SRC}"]`);
}

describe("TurnstileWidget", () => {
  beforeEach(() => {
    delete window.turnstile;
    document.querySelectorAll(`script[src="${SCRIPT_SRC}"]`).forEach((el) => el.remove());
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.useRealTimers();
    delete window.turnstile;
    document.querySelectorAll(`script[src="${SCRIPT_SRC}"]`).forEach((el) => el.remove());
  });

  it("renders nothing without a configured site key", async () => {
    const { TurnstileWidget } = await importWidget(undefined);
    const { container } = render(<TurnstileWidget onToken={() => {}} />);
    expect(container).toBeEmptyDOMElement();
    expect(scriptTag()).not.toBeInTheDocument();
  });

  it("renders the widget once the script loads and Turnstile calls render()", async () => {
    const { TurnstileWidget } = await importWidget("site-key-1");
    render(<TurnstileWidget onToken={() => {}} />);

    const script = scriptTag();
    expect(script).toBeInTheDocument();

    // Turnstile's own script sets window.turnstile as a side effect of
    // loading, before firing "load" — mirrored here in the same order.
    const renderSpy = vi.fn().mockReturnValue("widget-1");
    window.turnstile = { render: renderSpy, reset: vi.fn(), remove: vi.fn() };
    script!.dispatchEvent(new Event("load"));

    await waitFor(() => expect(renderSpy).toHaveBeenCalled());
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });

  // M-9 (Audit 06.09.2026): der haeufigste Fall — ein Werbe-/Skriptblocker
  // verhindert das Laden des Skripts selbst, das feuert "error", nie "load".
  it("shows an error message when the script fails to load (blocked)", async () => {
    const { TurnstileWidget } = await importWidget("site-key-1");
    render(<TurnstileWidget onToken={() => {}} />);

    const script = scriptTag();
    script!.dispatchEvent(new Event("error"));

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Mensch-Prüfung von Cloudflare konnte nicht geladen werden"
    );
  });

  // Der Rueckfall fuer jeden anderen stillen Ausfall: das Skript laedt,
  // aber render() erscheint nie (z.B. eine haengende Cloudflare-Pruefung).
  it("shows an error message after the load timeout when nothing ever renders", async () => {
    vi.useFakeTimers();
    const { TurnstileWidget } = await importWidget("site-key-1");
    render(<TurnstileWidget onToken={() => {}} />);

    act(() => void vi.advanceTimersByTime(8000));

    expect(screen.getByRole("alert")).toHaveTextContent(
      "Mensch-Prüfung von Cloudflare konnte nicht geladen werden"
    );
  });

  it("does not show an error if the widget renders before the timeout", async () => {
    vi.useFakeTimers();
    const { TurnstileWidget } = await importWidget("site-key-1");
    render(<TurnstileWidget onToken={() => {}} />);
    const script = scriptTag();

    const renderSpy = vi.fn().mockReturnValue("widget-1");
    window.turnstile = { render: renderSpy, reset: vi.fn(), remove: vi.fn() };
    act(() => void script!.dispatchEvent(new Event("load")));
    expect(renderSpy).toHaveBeenCalled();

    act(() => void vi.advanceTimersByTime(8000));

    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });
});
