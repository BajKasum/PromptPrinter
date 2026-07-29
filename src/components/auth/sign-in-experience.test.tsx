import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { SignInExperience } from "./sign-in-experience";

const push = vi.fn();
const refresh = vi.fn();
const signInWithPassword = vi.fn();
let searchParams = new URLSearchParams();

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push, refresh }),
  useSearchParams: () => searchParams,
}));

vi.mock("@/lib/supabase/client", () => ({
  createClient: () => ({ auth: { signInWithPassword } }),
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

vi.mock("@/components/brand/animated-mascot", () => ({
  AnimatedMascot: () => null,
}));

vi.mock("@/components/brand/success-celebration", () => ({
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
    signInWithPassword.mockReset();
  });

  it("rejects an invalid email without calling Supabase", async () => {
    render(<SignInExperience />);
    await fillAndSubmit("not-an-email", "password123");
    expect(screen.getByRole("alert")).toHaveTextContent("gültige Email");
    expect(signInWithPassword).not.toHaveBeenCalled();
  });

  it("rejects an empty password without calling Supabase", async () => {
    render(<SignInExperience />);
    await fillAndSubmit("user@example.com", "");
    expect(screen.getByRole("alert")).toHaveTextContent("Bitte Passwort eingeben");
    expect(signInWithPassword).not.toHaveBeenCalled();
  });

  // Inverted by Security-Audit finding M-5: this used to assert that login
  // refused anything under 8 characters. A length rule on a LOGIN form only
  // locks out accounts whose (valid) password predates the current policy —
  // Supabase's own default minimum is 6. Short-but-real credentials must reach
  // the auth server, which is the only thing that can judge them.
  it("sends a short existing password through to Supabase instead of blocking it", async () => {
    render(<SignInExperience />);
    await fillAndSubmit("user@example.com", "short");
    expect(signInWithPassword).toHaveBeenCalledWith(
      expect.objectContaining({ email: "user@example.com", password: "short" })
    );
  });

  it("maps a Supabase auth error to friendly German copy", async () => {
    signInWithPassword.mockResolvedValue({
      error: { message: "Invalid login credentials" },
    });
    render(<SignInExperience />);
    await fillAndSubmit("user@example.com", "password123");
    expect(await screen.findByRole("alert")).toHaveTextContent("Email oder Passwort falsch");
  });

  it("celebrates and redirects to the next param on success", async () => {
    searchParams = new URLSearchParams("next=/projects/42");
    signInWithPassword.mockResolvedValue({ error: null });
    render(<SignInExperience />);
    await fillAndSubmit("user@example.com", "password123");

    expect(signInWithPassword).toHaveBeenCalledWith({
      email: "user@example.com",
      password: "password123",
    });
    const celebration = await screen.findByRole("status");
    expect(celebration).toHaveTextContent("Erfolgreich eingeloggt");

    await userEvent.setup().click(screen.getByRole("button", { name: "weiter" }));
    expect(push).toHaveBeenCalledWith("/projects/42");
    expect(refresh).toHaveBeenCalled();
  });

  it("defaults the redirect target to /chats/new when no next param is given", async () => {
    signInWithPassword.mockResolvedValue({ error: null });
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
    signInWithPassword.mockResolvedValue({ error: null });
    render(<SignInExperience />);
    await fillAndSubmit("user@example.com", "password123");
    await userEvent.setup().click(await screen.findByRole("button", { name: "weiter" }));
    expect(push).toHaveBeenCalledWith("/chats/new");
  });

  it("never redirects to a protocol-relative next target", async () => {
    searchParams = new URLSearchParams({ next: "//evil.example" });
    signInWithPassword.mockResolvedValue({ error: null });
    render(<SignInExperience />);
    await fillAndSubmit("user@example.com", "password123");
    await userEvent.setup().click(await screen.findByRole("button", { name: "weiter" }));
    expect(push).toHaveBeenCalledWith("/chats/new");
  });
});
