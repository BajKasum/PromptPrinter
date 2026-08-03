import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { SignUpExperience } from "./sign-up-experience";
import { PASSWORD_RULE_HINT } from "@/shared/lib/password";

const push = vi.fn();
const refresh = vi.fn();
const postAuthAction = vi.fn();
let searchParams = new URLSearchParams();

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push, refresh }),
  useSearchParams: () => searchParams,
}));

const getUser = vi.fn();
const profileUpdate = vi.fn();
const profileSelect = vi.fn();

// Signup and resend go through POST /api/auth so the Turnstile token is
// redeemed in the same request (app/api/auth/route.ts). The browser Supabase
// client survives here for one thing only: the best-effort Pro-interest write
// after an account exists, which is not an auth call.
vi.mock("@/shared/lib/auth-client", () => ({
  postAuthAction: (...args: unknown[]) => postAuthAction(...args),
}));

vi.mock("@/shared/supabase/client", () => ({
  createClient: () => ({
    auth: { getUser },
    from: () => ({
      select: () => ({ eq: () => ({ maybeSingle: () => profileSelect() }) }),
      update: (patch: unknown) => ({ eq: () => profileUpdate(patch) }),
    }),
  }),
}));

vi.mock("@/shared/lib/site-url", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/shared/lib/site-url")>()),
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

// Same rationale as sign-in-experience.test.tsx: bypass jsdom's native
// type="email"/required constraint validation so our own Zod check runs.
// Ticks the terms checkbox by default, the one test exercising the
// terms guard passes acceptTerms: false explicitly.
async function fillAndSubmit(email: string, password: string, acceptTerms = true) {
  const user = userEvent.setup();
  const emailInput = screen.getByPlaceholderText("du@example.com");
  const passwordInput = screen.getByPlaceholderText(/^Passwort/);
  if (email) await user.type(emailInput, email);
  if (password) await user.type(passwordInput, password);
  if (acceptTerms) await user.click(screen.getByRole("checkbox"));
  fireEvent.submit(emailInput.closest("form")!);
  return user;
}

describe("SignUpExperience", () => {
  beforeEach(() => {
    searchParams = new URLSearchParams();
    push.mockReset();
    refresh.mockReset();
    postAuthAction.mockReset();
    postAuthAction.mockResolvedValue({ ok: true, session: true });
  });

  it("rejects an invalid email without calling the auth endpoint", async () => {
    render(<SignUpExperience />);
    await fillAndSubmit("not-an-email", "password123");
    expect(screen.getByRole("alert")).toHaveTextContent("gültige Email");
    expect(postAuthAction).not.toHaveBeenCalled();
  });

  it("rejects a password shorter than 8 characters", async () => {
    render(<SignUpExperience />);
    await fillAndSubmit("user@example.com", "short");
    expect(screen.getByRole("alert")).toHaveTextContent(PASSWORD_RULE_HINT);
    expect(postAuthAction).not.toHaveBeenCalled();
  });

  it("blocks submission until the terms checkbox is accepted", async () => {
    render(<SignUpExperience />);
    await fillAndSubmit("user@example.com", "password123", false);
    expect(screen.getByRole("alert")).toHaveTextContent("AGB");
    expect(postAuthAction).not.toHaveBeenCalled();
  });

  // The German wording itself is the route's job now (translateAuthError runs
  // there); what this asserts is that the form renders whatever came back.
  it("shows the failure the endpoint reported", async () => {
    postAuthAction.mockResolvedValue({
      ok: false,
      message: "Diese Email ist bereits registriert, bitte einloggen",
      captchaFailed: false,
    });
    render(<SignUpExperience />);
    await fillAndSubmit("user@example.com", "password123");
    expect(await screen.findByRole("alert")).toHaveTextContent("bereits registriert");
  });

  it("surfaces a failed human check instead of creating an account", async () => {
    postAuthAction.mockResolvedValue({
      ok: false,
      message: "Die Mensch-Prüfung ist fehlgeschlagen. Bitte lade die Seite neu und versuch es erneut.",
      captchaFailed: true,
    });
    render(<SignUpExperience />);
    await fillAndSubmit("user@example.com", "password123");
    expect(await screen.findByRole("alert")).toHaveTextContent("Mensch-Prüfung");
    expect(screen.queryByText("Email unterwegs")).not.toBeInTheDocument();
  });

  it("shows the confirmation-email state when signup returns no session", async () => {
    postAuthAction.mockResolvedValue({ ok: true, session: false });
    render(<SignUpExperience />);
    await fillAndSubmit("user@example.com", "password123");

    expect(await screen.findByText("Email unterwegs")).toBeInTheDocument();
    // The confirmation link's absolute URL is built server-side now, so what
    // travels from here is the in-app path the route re-validates.
    expect(postAuthAction).toHaveBeenCalledWith(
      {
        action: "sign-up",
        email: "user@example.com",
        password: "password123",
        next: "/chats/new",
      },
      null
    );
  });

  it("resends the confirmation email from the sent state", async () => {
    postAuthAction.mockResolvedValue({ ok: true, session: false });
    render(<SignUpExperience />);
    await fillAndSubmit("user@example.com", "password123");
    await screen.findByText("Email unterwegs");

    const user = userEvent.setup();
    await user.click(screen.getByRole("button", { name: /Email erneut senden/ }));

    expect(postAuthAction).toHaveBeenLastCalledWith(
      expect.objectContaining({ action: "resend", email: "user@example.com" }),
      null
    );
    expect(await screen.findByText(/erneut gesendet/)).toBeInTheDocument();
  });

  it("celebrates and redirects immediately when a session comes back", async () => {
    render(<SignUpExperience />);
    await fillAndSubmit("user@example.com", "password123");

    expect(await screen.findByRole("status")).toHaveTextContent("Konto erstellt");
    await userEvent.setup().click(screen.getByRole("button", { name: "weiter" }));
    expect(push).toHaveBeenCalledWith("/chats/new");
    expect(refresh).toHaveBeenCalled();
  });

  it("never redirects to an attacker-supplied next target", async () => {
    searchParams = new URLSearchParams({ next: "https://evil.example/phish" });
    render(<SignUpExperience />);
    await fillAndSubmit("user@example.com", "password123");
    await userEvent.setup().click(await screen.findByRole("button", { name: "weiter" }));
    expect(push).toHaveBeenCalledWith("/chats/new");
  });

  it("never redirects to a protocol-relative next target", async () => {
    searchParams = new URLSearchParams({ next: "//evil.example" });
    render(<SignUpExperience />);
    await fillAndSubmit("user@example.com", "password123");
    await userEvent.setup().click(await screen.findByRole("button", { name: "weiter" }));
    expect(push).toHaveBeenCalledWith("/chats/new");
  });
  // QA finding U-2: the pricing page's Pro button linked here with ?plan=pro
  // and nobody read it. The visitor clicked a paid plan, landed on Free, and
  // only learned that payment isn't live once past the login.
  describe("arriving through the Pro button", () => {
    beforeEach(() => {
      getUser.mockReset();
      profileSelect.mockReset();
      profileUpdate.mockReset();
      getUser.mockResolvedValue({ data: { user: { id: "user-1" } } });
      profileSelect.mockResolvedValue({ data: { settings: { onboarding_done: true } } });
      profileUpdate.mockResolvedValue({ error: null });
    });

    it("says plainly that payment is not live yet", () => {
      searchParams = new URLSearchParams("plan=pro");
      render(<SignUpExperience />);
      expect(screen.getByText(/Bezahlung ist noch nicht freigeschaltet/)).toBeInTheDocument();
    });

    it("stays quiet for a plain signup", () => {
      searchParams = new URLSearchParams();
      render(<SignUpExperience />);
      expect(screen.queryByText(/Bezahlung ist noch nicht freigeschaltet/)).not.toBeInTheDocument();
    });

    it("records the interest without discarding the existing settings", async () => {
      searchParams = new URLSearchParams("plan=pro");
        render(<SignUpExperience />);

      await fillAndSubmit("neu@example.com", "sicheres-passwort");
      await screen.findByRole("status");

      expect(profileUpdate).toHaveBeenCalledWith({
        settings: { onboarding_done: true, interested_in: "pro" },
      });
    });

    it("never records anything for a plain signup", async () => {
      searchParams = new URLSearchParams();
        render(<SignUpExperience />);

      await fillAndSubmit("neu@example.com", "sicheres-passwort");
      await screen.findByRole("status");

      expect(profileUpdate).not.toHaveBeenCalled();
    });
  });
});
