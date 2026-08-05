import { beforeEach, describe, expect, it, vi } from "vitest";
import { act, render, screen } from "@testing-library/react";
import { ProCheckoutCta } from "./pro-checkout-cta";
import type { MarketingPlan } from "@/shared/lib/pricing";

const getUser = vi.fn();

vi.mock("@/shared/supabase/client", () => ({
  createClient: () => ({ auth: { getUser: () => getUser() } }),
}));

// LemonCheckoutButton trägt seine eigene, ausführliche Testabdeckung
// (shared/ui/lemon-checkout-button.test.tsx) — hier interessiert nur, OB und
// MIT WELCHEN Angaben ProCheckoutCta es einsetzt, nicht wie es sich intern
// verhält.
const checkoutProps: Record<string, unknown>[] = [];
vi.mock("@/shared/ui/lemon-checkout-button", () => ({
  LemonCheckoutButton: (props: Record<string, unknown>) => {
    checkoutProps.push(props);
    return <a href="#checkout">{props.children as React.ReactNode}</a>;
  },
}));

const plan: MarketingPlan = {
  name: "Pro",
  price: "5,90 €",
  cadence: "Monat",
  description: "Test",
  cta: "Pro holen",
  href: "/signup?plan=pro",
  checkout: true,
  highlight: true,
  mascot: "celebrating",
  features: [],
};

beforeEach(() => {
  getUser.mockReset();
  checkoutProps.length = 0;
});

describe("ProCheckoutCta", () => {
  it("startet als Link auf das Signup-Ziel, bevor der Login-Stand feststeht", () => {
    getUser.mockReturnValue(new Promise(() => {})); // löst absichtlich nie auf
    render(<ProCheckoutCta plan={plan} />);

    const link = screen.getByRole("link", { name: "Pro holen" });
    expect(link).toHaveAttribute("href", "/signup?plan=pro");
    expect(checkoutProps).toHaveLength(0);
  });

  it("bleibt beim Signup-Link, wenn niemand angemeldet ist", async () => {
    getUser.mockResolvedValue({ data: { user: null } });
    render(<ProCheckoutCta plan={plan} />);

    await screen.findByRole("link", { name: "Pro holen" });
    expect(screen.getByRole("link")).toHaveAttribute("href", "/signup?plan=pro");
    expect(checkoutProps).toHaveLength(0);
  });

  it("schaltet auf den direkten Checkout um, sobald eine Sitzung bestätigt ist", async () => {
    getUser.mockResolvedValue({
      data: { user: { id: "user-42", email: "kasum@example.test" } },
    });
    render(<ProCheckoutCta plan={plan} />);

    await screen.findByText("Pro holen");
    expect(checkoutProps).toHaveLength(1);
    expect(checkoutProps[0]).toMatchObject({
      fallbackHref: "/signup?plan=pro",
      email: "kasum@example.test",
      userId: "user-42",
    });
  });

  it("reicht eine fehlende Mail als null durch, statt sie zu erfinden", async () => {
    getUser.mockResolvedValue({ data: { user: { id: "user-42", email: undefined } } });
    render(<ProCheckoutCta plan={plan} />);

    await screen.findByText("Pro holen");
    expect(checkoutProps[0]).toMatchObject({ email: null, userId: "user-42" });
  });

  it("setzt keinen State mehr, nachdem die Komponente schon abgehängt wurde", async () => {
    let resolveUser: (v: unknown) => void = () => {};
    getUser.mockReturnValue(new Promise((resolve) => (resolveUser = resolve)));

    const { unmount } = render(<ProCheckoutCta plan={plan} />);
    unmount();

    const warn = vi.spyOn(console, "error").mockImplementation(() => {});
    await act(async () => {
      resolveUser({ data: { user: { id: "user-42", email: "kasum@example.test" } } });
    });
    expect(warn).not.toHaveBeenCalled();
    warn.mockRestore();
  });
});
