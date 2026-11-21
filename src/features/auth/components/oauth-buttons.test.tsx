import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { OAuthButtons } from "./oauth-buttons";

const signInWithOAuth = vi.fn();

vi.mock("@/shared/supabase/client", () => ({
  createClient: () => ({ auth: { signInWithOAuth } }),
}));

vi.mock("@/shared/lib/site-url", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/shared/lib/site-url")>()),
  siteUrl: (path: string) => `https://promptprinter.app${path}`,
}));

const visit = (url: string) => window.history.replaceState(null, "", url);

describe("OAuthButtons", () => {
  beforeEach(() => {
    signInWithOAuth.mockReset();
    visit("/login");
  });

  // Die Seite ist statisch gerendert: `next` kommt erst beim Klick aus der Adresse (lib/location-search.ts).
  it("starts the Google flow with the callback redirect carrying next", async () => {
    signInWithOAuth.mockResolvedValue({ error: null });
    visit("/login?next=/projects/42");
    render(<OAuthButtons />);

    await userEvent.setup().click(screen.getByRole("button", { name: /Weiter mit Google/ }));

    expect(signInWithOAuth).toHaveBeenCalledWith({
      provider: "google",
      options: {
        redirectTo: "https://promptprinter.app/auth/callback?next=%2Fprojects%2F42",
      },
    });
  });

  it("starts the GitHub flow", async () => {
    signInWithOAuth.mockResolvedValue({ error: null });
    render(<OAuthButtons />);

    await userEvent.setup().click(screen.getByRole("button", { name: /Weiter mit GitHub/ }));

    expect(signInWithOAuth).toHaveBeenCalledWith(
      expect.objectContaining({ provider: "github" })
    );
  });

  it("leitet ohne next in den Chat und folgt keiner fremden Adresse", async () => {
    signInWithOAuth.mockResolvedValue({ error: null });
    visit("/signup?" + new URLSearchParams({ next: "https://evil.example/phish" }));
    render(<OAuthButtons />);

    await userEvent.setup().click(screen.getByRole("button", { name: /Weiter mit GitHub/ }));

    expect(signInWithOAuth).toHaveBeenCalledWith({
      provider: "github",
      options: { redirectTo: "https://promptprinter.app/auth/callback?next=%2Fchats%2Fnew" },
    });
  });

  it("surfaces a provider error instead of navigating", async () => {
    signInWithOAuth.mockResolvedValue({
      error: { message: "Unsupported provider: provider is not enabled" },
    });
    render(<OAuthButtons />);

    await userEvent.setup().click(screen.getByRole("button", { name: /Weiter mit Google/ }));

    expect(await screen.findByRole("alert")).toBeInTheDocument();
    // Buttons recover so the user can retry or pick the other provider.
    expect(screen.getByRole("button", { name: /Weiter mit Google/ })).toBeEnabled();
  });

  // OAuth skips the signup form's terms checkbox and can create an account
  // from /login too, so the notice has to live in this shared component.
  it("tells the user that a new account accepts the AGB", () => {
    render(<OAuthButtons />);

    expect(screen.getByText(/akzeptierst du damit die/)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "AGB" })).toHaveAttribute("href", "/agb");
    expect(screen.getByRole("link", { name: "Datenschutzerklärung" })).toHaveAttribute(
      "href",
      "/datenschutz"
    );
  });

  it("disables both buttons while a flow is starting", async () => {
    // Never resolves, simulates the window between click and provider redirect.
    signInWithOAuth.mockReturnValue(new Promise(() => {}));
    render(<OAuthButtons />);

    await userEvent.setup().click(screen.getByRole("button", { name: /Weiter mit Google/ }));

    expect(screen.getByRole("button", { name: /Weiter mit Google/ })).toBeDisabled();
    expect(screen.getByRole("button", { name: /Weiter mit GitHub/ })).toBeDisabled();
  });
});
