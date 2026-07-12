import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { SignUpExperience } from "./sign-up-experience";

const push = vi.fn();
const refresh = vi.fn();
const signUp = vi.fn();
const resend = vi.fn();
let searchParams = new URLSearchParams();

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push, refresh }),
  useSearchParams: () => searchParams,
}));

vi.mock("@/lib/supabase/client", () => ({
  createClient: () => ({ auth: { signUp, resend } }),
}));

vi.mock("@/lib/site-url", () => ({
  siteUrl: (path: string) => `https://promptprinter.app${path}`,
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

// Same rationale as sign-in-experience.test.tsx: bypass jsdom's native
// type="email"/required constraint validation so our own Zod check runs.
async function fillAndSubmit(email: string, password: string) {
  const user = userEvent.setup();
  const emailInput = screen.getByPlaceholderText("du@example.com");
  const passwordInput = screen.getByPlaceholderText(/^Passwort/);
  if (email) await user.type(emailInput, email);
  if (password) await user.type(passwordInput, password);
  fireEvent.submit(emailInput.closest("form")!);
  return user;
}

describe("SignUpExperience", () => {
  beforeEach(() => {
    searchParams = new URLSearchParams();
    push.mockReset();
    refresh.mockReset();
    signUp.mockReset();
    resend.mockReset();
  });

  it("rejects an invalid email without calling Supabase", async () => {
    render(<SignUpExperience />);
    await fillAndSubmit("not-an-email", "password123");
    expect(screen.getByRole("alert")).toHaveTextContent("gültige Email");
    expect(signUp).not.toHaveBeenCalled();
  });

  it("rejects a password shorter than 8 characters", async () => {
    render(<SignUpExperience />);
    await fillAndSubmit("user@example.com", "short");
    expect(screen.getByRole("alert")).toHaveTextContent("Mindestens 8 Zeichen");
    expect(signUp).not.toHaveBeenCalled();
  });

  it("maps a Supabase signup error to friendly German copy", async () => {
    signUp.mockResolvedValue({ data: {}, error: { message: "User already registered" } });
    render(<SignUpExperience />);
    await fillAndSubmit("user@example.com", "password123");
    expect(await screen.findByRole("alert")).toHaveTextContent("bereits registriert");
  });

  it("shows the confirmation-email state when signup returns no session", async () => {
    signUp.mockResolvedValue({ data: { session: null }, error: null });
    render(<SignUpExperience />);
    await fillAndSubmit("user@example.com", "password123");

    expect(await screen.findByText("Email unterwegs")).toBeInTheDocument();
    expect(signUp).toHaveBeenCalledWith({
      email: "user@example.com",
      password: "password123",
      options: {
        emailRedirectTo: "https://promptprinter.app/auth/callback?next=%2Fchats%2Fnew",
      },
    });
  });

  it("resends the confirmation email from the sent state", async () => {
    signUp.mockResolvedValue({ data: { session: null }, error: null });
    resend.mockResolvedValue({ error: null });
    render(<SignUpExperience />);
    await fillAndSubmit("user@example.com", "password123");
    await screen.findByText("Email unterwegs");

    const user = userEvent.setup();
    await user.click(screen.getByRole("button", { name: /Email erneut senden/ }));

    expect(resend).toHaveBeenCalledWith(
      expect.objectContaining({ type: "signup", email: "user@example.com" })
    );
    expect(await screen.findByText(/erneut gesendet/)).toBeInTheDocument();
  });

  it("celebrates and redirects immediately when a session comes back", async () => {
    signUp.mockResolvedValue({ data: { session: { access_token: "t" } }, error: null });
    render(<SignUpExperience />);
    await fillAndSubmit("user@example.com", "password123");

    expect(await screen.findByRole("status")).toHaveTextContent("Konto erstellt");
    await userEvent.setup().click(screen.getByRole("button", { name: "weiter" }));
    expect(push).toHaveBeenCalledWith("/chats/new");
    expect(refresh).toHaveBeenCalled();
  });
});
