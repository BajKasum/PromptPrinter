import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { OAuthButtons } from "./oauth-buttons";

const signInWithOAuth = vi.fn();

vi.mock("@/lib/supabase/client", () => ({
  createClient: () => ({ auth: { signInWithOAuth } }),
}));

vi.mock("@/lib/site-url", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/site-url")>()),
  siteUrl: (path: string) => `https://promptprinter.app${path}`,
}));

describe("OAuthButtons", () => {
  beforeEach(() => {
    signInWithOAuth.mockReset();
  });

  it("starts the Google flow with the callback redirect carrying next", async () => {
    signInWithOAuth.mockResolvedValue({ error: null });
    render(<OAuthButtons next="/projects/42" />);

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
    render(<OAuthButtons next="/chats/new" />);

    await userEvent.setup().click(screen.getByRole("button", { name: /Weiter mit GitHub/ }));

    expect(signInWithOAuth).toHaveBeenCalledWith(
      expect.objectContaining({ provider: "github" })
    );
  });

  it("surfaces a provider error instead of navigating", async () => {
    signInWithOAuth.mockResolvedValue({
      error: { message: "Unsupported provider: provider is not enabled" },
    });
    render(<OAuthButtons next="/chats/new" />);

    await userEvent.setup().click(screen.getByRole("button", { name: /Weiter mit Google/ }));

    expect(await screen.findByRole("alert")).toBeInTheDocument();
    // Buttons recover so the user can retry or pick the other provider.
    expect(screen.getByRole("button", { name: /Weiter mit Google/ })).toBeEnabled();
  });

  it("disables both buttons while a flow is starting", async () => {
    // Never resolves, simulates the window between click and provider redirect.
    signInWithOAuth.mockReturnValue(new Promise(() => {}));
    render(<OAuthButtons next="/chats/new" />);

    await userEvent.setup().click(screen.getByRole("button", { name: /Weiter mit Google/ }));

    expect(screen.getByRole("button", { name: /Weiter mit Google/ })).toBeDisabled();
    expect(screen.getByRole("button", { name: /Weiter mit GitHub/ })).toBeDisabled();
  });
});
