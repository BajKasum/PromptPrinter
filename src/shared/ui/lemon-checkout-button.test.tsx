import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { LemonCheckoutButton } from "./lemon-checkout-button";
import { LEMON_JS_ID, type LemonSqueezyEvent } from "@/shared/lib/use-lemon-squeezy";

const CHECKOUT = "https://promptprinter.lemonsqueezy.com/checkout/buy/abc-123?embed=1";

// next/script lädt in jsdom nichts, und genau darum geht es hier auch nicht:
// interessant ist, MIT WELCHEN Angaben die Komponente das Skript anfordert.
const scriptProps: { id?: string; src?: string; strategy?: string }[] = [];
vi.mock("next/script", () => ({
  default: (props: { id?: string; src?: string; strategy?: string }) => {
    scriptProps.push(props);
    return null;
  },
}));

const open = vi.fn();
const close = vi.fn();
const hideLoader = vi.fn();
/**
 * Der Ereignis-Handler, den das Modul EINMAL bei Lemon.js registriert.
 *
 * Bewusst nicht pro Test zurückgesetzt: dass er nur einmal eingehängt wird,
 * ist die Zusage des Moduls (`Setup` kennt nur einen Platz). Er verteilt an
 * die jeweils angemeldeten Zuhörer, funktioniert also auch für später
 * gerenderte Knöpfe.
 */
let dispatchLemonEvent: ((event: LemonSqueezyEvent) => void) | null = null;

function installFakeLemonJs() {
  window.LemonSqueezy = {
    Setup: ({ eventHandler }) => {
      dispatchLemonEvent = eventHandler;
    },
    Refresh: vi.fn(),
    Url: { Open: open, Close: close },
    Loader: { Hide: hideLoader },
  };
  window.createLemonSqueezy = vi.fn();
}

/** Merkt sich, ob der Klick den Browser hätte navigieren lassen. */
function trackNavigation() {
  const state = { prevented: false, href: "" };
  const listener = (event: Event) => {
    event.preventDefault(); // jsdom kann nicht navigieren
    state.prevented = event.defaultPrevented;
    state.href = (event.target as HTMLElement).closest("a")?.getAttribute("href") ?? "";
  };
  // In der Bubble-Phase, also NACH dem onClick der Komponente.
  document.addEventListener("click", listener);
  return {
    state,
    stop: () => document.removeEventListener("click", listener),
  };
}

beforeEach(() => {
  scriptProps.length = 0;
  open.mockReset();
  close.mockReset();
  hideLoader.mockReset();
  vi.stubEnv("NEXT_PUBLIC_LEMONSQUEEZY_CHECKOUT_URL", CHECKOUT);
});

afterEach(() => {
  vi.unstubAllEnvs();
  delete window.LemonSqueezy;
  delete window.createLemonSqueezy;
  document.documentElement.classList.remove("dark");
});

describe("LemonCheckoutButton", () => {
  it("renders a real link to the checkout, not a dead button", () => {
    render(
      <LemonCheckoutButton fallbackHref="/signup">Pro holen</LemonCheckoutButton>
    );
    const link = screen.getByRole("link", { name: "Pro holen" });
    expect(link).toHaveAttribute("href", expect.stringContaining("/checkout/buy/abc-123"));
    expect(link.getAttribute("href")).toContain("embed=1");
  });

  it("requests Lemon.js under a fixed id, so two buttons cannot load it twice", () => {
    render(
      <>
        <LemonCheckoutButton fallbackHref="/signup">Pro holen</LemonCheckoutButton>
        <LemonCheckoutButton fallbackHref="/signup">Auch Pro holen</LemonCheckoutButton>
      </>
    );
    expect(scriptProps).toHaveLength(2);
    expect(scriptProps.every((p) => p.id === LEMON_JS_ID)).toBe(true);
    expect(new Set(scriptProps.map((p) => p.src)).size).toBe(1);
  });

  it("falls back to the given href and loads nothing when no checkout is configured", () => {
    vi.stubEnv("NEXT_PUBLIC_LEMONSQUEEZY_CHECKOUT_URL", "");
    render(<LemonCheckoutButton fallbackHref="/signup?plan=pro">Pro holen</LemonCheckoutButton>);

    expect(screen.getByRole("link", { name: "Pro holen" })).toHaveAttribute(
      "href",
      "/signup?plan=pro"
    );
    expect(scriptProps).toHaveLength(0);
  });

  it("opens the overlay and stops the navigation once Lemon.js is there", async () => {
    installFakeLemonJs();
    render(<LemonCheckoutButton fallbackHref="/signup">Pro holen</LemonCheckoutButton>);

    const nav = trackNavigation();
    await userEvent.click(screen.getByRole("link", { name: "Pro holen" }));
    nav.stop();

    expect(open).toHaveBeenCalledTimes(1);
    expect(open.mock.calls[0][0]).toContain("/checkout/buy/abc-123");
    expect(nav.state.prevented).toBe(true);
  });

  it("lets the browser follow the link while Lemon.js is still missing", async () => {
    render(<LemonCheckoutButton fallbackHref="/signup">Pro holen</LemonCheckoutButton>);

    const nav = trackNavigation();
    const link = screen.getByRole("link", { name: "Pro holen" });
    // defaultPrevented VOR dem Aufräum-Listener ablesen: der verhindert das
    // Navigieren selbst, also zählt nur, was die Komponente vorher tat.
    let preventedByComponent = false;
    link.addEventListener("click", (e) => {
      preventedByComponent = e.defaultPrevented;
    });
    await userEvent.click(link);
    nav.stop();

    expect(open).not.toHaveBeenCalled();
    expect(preventedByComponent).toBe(false);
  });

  it("leaves modifier clicks to the browser, so 'open in new tab' keeps working", async () => {
    installFakeLemonJs();
    render(<LemonCheckoutButton fallbackHref="/signup">Pro holen</LemonCheckoutButton>);

    // Eine Sitzung über beide Aufrufe hinweg: die direkte API legt pro Aufruf
    // eine neue an, die gedrückte Taste ginge zwischen keyboard() und click()
    // verloren und der Test würde einen gewöhnlichen Klick prüfen.
    const user = userEvent.setup();
    const nav = trackNavigation();
    await user.keyboard("{Meta>}");
    await user.click(screen.getByRole("link", { name: "Pro holen" }));
    await user.keyboard("{/Meta}");
    nav.stop();

    expect(open).not.toHaveBeenCalled();
  });

  it("asks for the dark checkout when the page itself is dark", async () => {
    installFakeLemonJs();
    document.documentElement.classList.add("dark");
    render(<LemonCheckoutButton fallbackHref="/signup">Pro holen</LemonCheckoutButton>);

    const nav = trackNavigation();
    await userEvent.click(screen.getByRole("link", { name: "Pro holen" }));
    nav.stop();

    expect(open.mock.calls[0][0]).toContain("dark=1");
  });

  it("does not ask for dark on the light public site", async () => {
    installFakeLemonJs();
    render(<LemonCheckoutButton fallbackHref="/signup">Pro holen</LemonCheckoutButton>);

    const nav = trackNavigation();
    await userEvent.click(screen.getByRole("link", { name: "Pro holen" }));
    nav.stop();

    expect(open.mock.calls[0][0]).not.toContain("dark=1");
  });

  it("carries the signed-in buyer's mail and account id into the checkout", () => {
    render(
      <LemonCheckoutButton fallbackHref="/pricing" email="kasum@example.test" userId="user-7">
        Pro holen
      </LemonCheckoutButton>
    );
    const href = screen.getByRole("link", { name: "Pro holen" }).getAttribute("href") ?? "";
    const params = new URL(href).searchParams;
    expect(params.get("checkout[email]")).toBe("kasum@example.test");
    expect(params.get("checkout[custom][user_id]")).toBe("user-7");
  });

  it("confirms the purchase in place of the button when the checkout reports success", async () => {
    installFakeLemonJs();
    render(
      <LemonCheckoutButton fallbackHref="/pricing" successMessage="Zahlung da, Rest folgt.">
        Pro holen
      </LemonCheckoutButton>
    );

    expect(dispatchLemonEvent).not.toBeNull();
    act(() => dispatchLemonEvent!({ event: "Checkout.Success" }));

    expect(await screen.findByRole("status")).toHaveTextContent("Zahlung da, Rest folgt.");
    expect(screen.queryByRole("link", { name: "Pro holen" })).not.toBeInTheDocument();
  });

  it("ignores the other checkout events, only a completed purchase counts", () => {
    installFakeLemonJs();
    render(<LemonCheckoutButton fallbackHref="/pricing">Pro holen</LemonCheckoutButton>);

    act(() => dispatchLemonEvent!({ event: "Checkout.ViewCart" }));

    expect(screen.queryByRole("status")).not.toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Pro holen" })).toBeInTheDocument();
  });

  // Lemon.js legt beim Öffnen einen Ladeschleier über die Seite und nimmt ihn
  // erst weg, wenn die eingebettete Seite sich meldet. Bleibt sie aus, hat das
  // Skript selbst keinen Weg zurück — der Besucher sässe vor einer leeren
  // Fläche. Diese vier Fälle sichern die Notbremse ab.
  describe("wenn die eingebettete Seite nicht erscheint", () => {
    // Hier bewusst fireEvent statt userEvent: userEvent wartet intern selbst
    // auf Zeitgeber, und mit vi.useFakeTimers() blockiert das den Test. Dass
    // ein echter Nutzerklick den Weg auslöst, ist oben schon abgedeckt — hier
    // geht es nur um das, was danach passiert.
    const originalLocation = window.location;

    /** Klickt und gibt den Navigations-Spion zurück. */
    function clickAndWatchNavigation() {
      const assign = vi.fn();
      Object.defineProperty(window, "location", {
        configurable: true,
        writable: true,
        value: { href: originalLocation.href, assign },
      });
      const nav = trackNavigation();
      fireEvent.click(screen.getByRole("link", { name: "Pro holen" }));
      nav.stop();
      return assign;
    }

    beforeEach(() => {
      vi.useFakeTimers();
      installFakeLemonJs();
    });

    afterEach(() => {
      vi.useRealTimers();
      Object.defineProperty(window, "location", {
        configurable: true,
        writable: true,
        value: originalLocation,
      });
    });

    it("räumt auf und öffnet den Checkout als ganze Seite", () => {
      render(<LemonCheckoutButton fallbackHref="/pricing">Pro holen</LemonCheckoutButton>);
      const assign = clickAndWatchNavigation();

      expect(assign).not.toHaveBeenCalled(); // noch wird gewartet
      act(() => void vi.advanceTimersByTime(10_000));

      expect(close).toHaveBeenCalledTimes(1);
      expect(hideLoader).toHaveBeenCalledTimes(1);
      expect(assign).toHaveBeenCalledWith(expect.stringContaining("/checkout/buy/abc-123"));
    });

    it("hört auf zu warten, sobald die Seite da ist", () => {
      render(<LemonCheckoutButton fallbackHref="/pricing">Pro holen</LemonCheckoutButton>);
      const assign = clickAndWatchNavigation();

      act(() => dispatchLemonEvent!("mounted"));
      act(() => void vi.advanceTimersByTime(10_000));

      expect(close).not.toHaveBeenCalled();
      expect(assign).not.toHaveBeenCalled();
    });

    it("hört auch auf zu warten, wenn der Besucher abbricht", () => {
      render(<LemonCheckoutButton fallbackHref="/pricing">Pro holen</LemonCheckoutButton>);
      const assign = clickAndWatchNavigation();

      act(() => dispatchLemonEvent!("close"));
      act(() => void vi.advanceTimersByTime(10_000));

      expect(assign).not.toHaveBeenCalled();
    });

    it("nimmt den Zeitgeber beim Unmount mit, sonst navigiert er von einer fremden Seite weg", () => {
      const view = render(
        <LemonCheckoutButton fallbackHref="/pricing">Pro holen</LemonCheckoutButton>
      );
      const assign = clickAndWatchNavigation();

      view.unmount();
      act(() => void vi.advanceTimersByTime(10_000));

      expect(assign).not.toHaveBeenCalled();
    });
  });

  it("unsubscribes on unmount, a stale button must not react to a later purchase", () => {
    installFakeLemonJs();
    const first = render(
      <LemonCheckoutButton fallbackHref="/pricing">Pro holen</LemonCheckoutButton>
    );
    first.unmount();

    // Nach dem Abmelden darf das Ereignis niemanden mehr erreichen — ein
    // React-Warnhinweis über setState auf einer entfernten Komponente wäre
    // genau das Leck, das der Set-Eintrag sonst offen liesse.
    const warn = vi.spyOn(console, "error").mockImplementation(() => {});
    act(() => dispatchLemonEvent!({ event: "Checkout.Success" }));
    expect(warn).not.toHaveBeenCalled();
    warn.mockRestore();
  });
});
