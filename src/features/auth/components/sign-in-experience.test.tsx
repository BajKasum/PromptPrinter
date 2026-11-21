import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { SignInExperience } from "./sign-in-experience";
import { fillBeforeHydration, renderStaticPage, serverHtml } from "@tests/support/static-page";

const push = vi.fn();
const refresh = vi.fn();
const postAuthAction = vi.fn();
const visit = (url: string) => window.history.replaceState(null, "", url);

// Ohne `useSearchParams`: die Seite liest die Adresse selbst (lib/location-search.ts). Liest die Komponente es doch
// wieder, scheitert hier jeder Test, weil die Attrappe es nicht anbietet.
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push, refresh }),
}));

// The form posts to /api/auth rather than calling Supabase from the browser,
// so that the Turnstile token is redeemed in the same request that signs in
// (app/api/auth/route.ts). These tests therefore assert what the form SENDS
// and how it renders what comes back; the credential handling itself, and the
// German wording of a failure, belong to the route and are tested there.
vi.mock("@/shared/lib/auth-client", () => ({
  postAuthAction: (...args: unknown[]) => postAuthAction(...args),
}));

vi.mock("@/features/auth/components/auth-experience-shell", () => ({
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
    visit("/login");
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
    visit("/login?next=/projects/42");
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
    visit("/login?error=auth_callback_failed");
    render(<SignInExperience />);
    expect(screen.getByRole("alert")).toHaveTextContent("Bestätigungs- oder Reset-Link");
  });

  // M-8 (Audit 06.09.2026): ein abgebrochener oder gescheiterter OAuth-Login
  // zeigte bisher denselben Satz ueber Bestaetigungs-/Reset-Links, der damit
  // nichts zu tun hat, und eine Handlungsaufforderung ("neuen Link
  // anfordern"), die es fuer OAuth gar nicht gibt.
  it("prefills a distinct message for a self-cancelled OAuth login", () => {
    visit("/login?error=oauth_cancelled");
    render(<SignInExperience />);
    const alert = screen.getByRole("alert");
    expect(alert).toHaveTextContent("abgebrochen");
    expect(alert).not.toHaveTextContent("Bestätigungs- oder Reset-Link");
  });

  it("prefills a distinct message for a genuine OAuth failure", () => {
    visit("/login?error=oauth_failed");
    render(<SignInExperience />);
    const alert = screen.getByRole("alert");
    expect(alert).toHaveTextContent("nicht geklappt");
    expect(alert).not.toHaveTextContent("Bestätigungs- oder Reset-Link");
  });

  it("never redirects to an attacker-supplied next target", async () => {
    visit("/login?" + new URLSearchParams({ next: "https://evil.example/phish" }));
    render(<SignInExperience />);
    await fillAndSubmit("user@example.com", "password123");
    await userEvent.setup().click(await screen.findByRole("button", { name: "weiter" }));
    expect(push).toHaveBeenCalledWith("/chats/new");
  });

  it("never redirects to a protocol-relative next target", async () => {
    visit("/login?" + new URLSearchParams({ next: "//evil.example" }));
    render(<SignInExperience />);
    await fillAndSubmit("user@example.com", "password123");
    await userEvent.setup().click(await screen.findByRole("button", { name: "weiter" }));
    expect(push).toHaveBeenCalledWith("/chats/new");
  });

  it("geht mit next aus der Adresse zum zweiten Faktor", async () => {
    postAuthAction.mockResolvedValue({ ok: true, mfaRequired: true });
    visit("/login?next=/projects/42");
    render(<SignInExperience />);
    await fillAndSubmit("user@example.com", "password123");
    await vi.waitFor(() => expect(push).toHaveBeenCalledWith("/login/zweiter-faktor?next=%2Fprojects%2F42"));
  });

  // /login ist statisch vorgerendert: das HTML entsteht ohne Query und kommt vom CDN. Die Seite liest `next` und
  // `error` deshalb erst nach dem Hydrieren (lib/location-search.ts) und übernimmt, was bis dahin in den Feldern
  // stand (lib/prefilled-input.ts).
  describe("statisch vorgerendert", () => {
    it("liefert das Formular im Server-HTML, ohne die Adresse zu kennen", () => {
      const html = serverHtml(<SignInExperience />, "/login");
      expect(html).toContain("Willkommen zurück");
      expect(html).toContain('id="login-email"');
      expect(html).toContain('id="login-password"');
      expect(html).not.toContain('role="alert"');
    });

    it("hydriert mit ?error= ohne Unterschied zum Server und zeigt die Meldung danach", async () => {
      const { hydrationErrors } = await renderStaticPage(<SignInExperience />, { url: "/login?error=oauth_cancelled" });
      expect(hydrationErrors).toEqual([]);
      expect(screen.getByRole("alert")).toHaveTextContent("abgebrochen");
    });

    it("übernimmt, was vor dem Hydrieren in den Feldern stand", async () => {
      await renderStaticPage(<SignInExperience />, {
        url: "/login?next=/projects/42",
        beforeHydration: (container) => {
          fillBeforeHydration(container, "#login-email", "user@example.com");
          fillBeforeHydration(container, "#login-password", "password123");
        },
      });
      fireEvent.submit(screen.getByPlaceholderText("du@example.com").closest("form")!);

      expect(postAuthAction).toHaveBeenCalledWith(
        { action: "sign-in", email: "user@example.com", password: "password123" },
        null
      );
      await screen.findByRole("status");
      // Nach dem Rendern stehen die Werte noch im Feld: React setzt es nicht auf einen leeren State zurück.
      expect(screen.getByPlaceholderText("du@example.com")).toHaveValue("user@example.com");
      await userEvent.setup().click(screen.getByRole("button", { name: "weiter" }));
      expect(push).toHaveBeenCalledWith("/projects/42");
    });
  });
});
