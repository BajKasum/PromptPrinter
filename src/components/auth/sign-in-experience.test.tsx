import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { SignInExperience } from "./sign-in-experience";

const push = vi.fn();
const refresh = vi.fn();
const postAuthAction = vi.fn();
let searchParams = new URLSearchParams();

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push, refresh }),
  useSearchParams: () => searchParams,
}));

// The form posts to /api/auth rather than calling Supabase from the browser,
// so that the Turnstile token is redeemed in the same request that signs in
// (app/api/auth/route.ts). These tests therefore assert what the form SENDS
// and how it renders what comes back; the credential handling itself, and the
// German wording of a failure, belong to the route and are tested there.
vi.mock("@/shared/lib/auth-client", () => ({
  postAuthAction: (...args: unknown[]) => postAuthAction(...args),
}));

vi.mock("@/components/auth/auth-experience-shell", () => ({
  AuthExperienceShell: ({
    children,
    overlay,
  }: {
    children: React.ReactNode;
    overlay?: React.ReactNode;
  }) => (
    <div>
      {overlay}
      {children}
    </div>
  ),
}));

vi.mock("@/shared/brand/animated-mascot", () => ({
  AnimatedMascot: () => null,
}));

vi.mock("@/shared/brand/success-celebration", () => ({
  SuccessCelebration: ({ message, onDone }: { message: string; onDone: () => void }) => (
    <div role="status">
      {message}
      <button onClick={onDone}>weiter</button>
    </div>
  ),
}));

// Submits via fireEvent instead of clicking the submit button: the email
// input's native `type="email"` + `required` constraints would otherwise let
// jsdom's HTML5 validation swallow the "submit" event before our own Zod
// check ever runs, which is exactly the branch these tests exercise.
async function fillAndSubmit(email: string, password: string) {
  const user = userEvent.setup();
  const emailInput = screen.getByPlaceholderText("du@example.com");
  const passwordInput = screen.getByPlaceholderText("Passwort");
  if (email) await user.type(emailInput, email);
  if (password) await user.type(passwordInput, password);
  fireEvent.submit(emailInput.closest("form")!);
  return user;
}

describe("SignInExperience", () => {
  beforeEach(() => {
    searchParams = new URLSearchParams();
    push.mockReset();
    refresh.mockReset();
    postAuthAction.mockReset();
    postAuthAction.mockResolvedValue({ ok: true, session: true });
  });

  it("rejects an invalid email without calling the auth endpoint", async () => {
    render(<SignInExperience />);
    await fillAndSubmit("not-an-email", "password123");
    expect(screen.getByRole("alert")).toHaveTextContent("gültige Email");
    expect(postAuthAction).not.toHaveBeenCalled();
  });

  it("rejects an empty password without calling the auth endpoint", async () => {
    render(<SignInExperience />);
    await fillAndSubmit("user@example.com", "");
    expect(screen.getByRole("alert")).toHaveTextContent("Bitte Passwort eingeben");
    expect(postAuthAction).not.toHaveBeenCalled();
  });

  // Inverted by Security-Audit finding M-5: this used to assert that login
  // refused anything under 8 characters. A length rule on a LOGIN form only
  // locks out accounts whose (valid) password predates the current policy —
  // Supabase's own default minimum is 6. Short-but-real credentials must reach
  // the auth server, which is the only thing that can judge them.
  it("sends a short existing password through instead of blocking it", async () => {
    render(<SignInExperience />);
    await fillAndSubmit("user@example.com", "short");
    expect(postAuthAction).toHaveBeenCalledWith(
      expect.objectContaining({ email: "user@example.com", password: "short" }),
      null
    );
  });

  it("shows the failure the endpoint reported", async () => {
    postAuthAction.mockResolvedValue({
      ok: false,
      message: "Email oder Passwort falsch",
      captchaFailed: false,
    });
    render(<SignInExperience />);
    await fillAndSubmit("user@example.com", "password123");
    expect(await screen.findByRole("alert")).toHaveTextContent("Email oder Passwort falsch");
  });

  it("surfaces a failed human check the same way, so the retry is obvious", async () => {
    postAuthAction.mockResolvedValue({
      ok: false,
      message: "Die Mensch-Prüfung ist fehlgeschlagen. Bitte lade die Seite neu und versuch es erneut.",
      captchaFailed: true,
    });
    render(<SignInExperience />);
    await fillAndSubmit("user@example.com", "password123");
    expect(await screen.findByRole("alert")).toHaveTextContent("Mensch-Prüfung");
  });

  it("celebrates and redirects to the next param on success", async () => {
    searchParams = new URLSearchParams("next=/projects/42");
    render(<SignInExperience />);
    await fillAndSubmit("user@example.com", "password123");

    expect(postAuthAction).toHaveBeenCalledWith(
      { action: "sign-in", email: "user@example.com", password: "password123" },
      null
    );
    const celebration = await screen.findByRole("status");
    expect(celebration).toHaveTextContent("Erfolgreich eingeloggt");

    await userEvent.setup().click(screen.getByRole("button", { name: "weiter" }));
    expect(push).toHaveBeenCalledWith("/projects/42");
    expect(refresh).toHaveBeenCalled();
  });

  it("defaults the redirect target to /chats/new when no next param is given", async () => {
    render(<SignInExperience />);
    await fillAndSubmit("user@example.com", "password123");
    await userEvent.setup().click(await screen.findByRole("button", { name: "weiter" }));
    expect(push).toHaveBeenCalledWith("/chats/new");
  });

  it("prefills an error when arriving with error=auth_callback_failed", () => {
    searchParams = new URLSearchParams("error=auth_callback_failed");
    render(<SignInExperience />);
    expect(screen.getByRole("alert")).toHaveTextContent("Bestätigungs- oder Reset-Link");
  });

  it("never redirects to an attacker-supplied next target", async () => {
    searchParams = new URLSearchParams({ next: "https://evil.example/phish" });
    render(<SignInExperience />);
    await fillAndSubmit("user@example.com", "password123");
    await userEvent.setup().click(await screen.findByRole("button", { name: "weiter" }));
    expect(push).toHaveBeenCalledWith("/chats/new");
  });

  it("never redirects to a protocol-relative next target", async () => {
    searchParams = new URLSearchParams({ next: "//evil.example" });
    render(<SignInExperience />);
    await fillAndSubmit("user@example.com", "password123");
    await userEvent.setup().click(await screen.findByRole("button", { name: "weiter" }));
    expect(push).toHaveBeenCalledWith("/chats/new");
  });
});
