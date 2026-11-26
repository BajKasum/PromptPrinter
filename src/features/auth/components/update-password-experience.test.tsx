import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { UpdatePasswordExperience } from "./update-password-experience";
import { fillBeforeHydration, renderStaticPage } from "@tests/support/static-page";
import { MIN_PASSWORD_LENGTH, PASSWORD_TOO_SHORT_MESSAGE } from "@/shared/lib/password";

const push = vi.fn();
const refresh = vi.fn();
const updateUser = vi.fn();

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push, refresh }),
}));

vi.mock("@/shared/supabase/client", () => ({
  createClient: () => ({ auth: { updateUser } }),
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

vi.mock("@/shared/brand/success-celebration", () => ({
  SuccessCelebration: ({ message, onDone }: { message: string; onDone: () => void }) => (
    <div role="status">
      {message}
      <button onClick={onDone}>weiter</button>
    </div>
  ),
}));

async function fillAndSubmit(next: string, confirm: string) {
  const user = userEvent.setup();
  const nextInput = screen.getByPlaceholderText(`Neues Passwort (mind. ${MIN_PASSWORD_LENGTH} Zeichen)`);
  const confirmInput = screen.getByPlaceholderText("Passwort wiederholen");
  if (next) await user.type(nextInput, next);
  if (confirm) await user.type(confirmInput, confirm);
  fireEvent.submit(nextInput.closest("form")!);
  return user;
}

describe("UpdatePasswordExperience", () => {
  beforeEach(() => {
    push.mockReset();
    refresh.mockReset();
    updateUser.mockReset();
  });

  it("rejects a password shorter than 8 characters", async () => {
    render(<UpdatePasswordExperience email="user@example.com" />);
    await fillAndSubmit("short", "short");
    expect(screen.getByRole("alert")).toHaveTextContent(PASSWORD_TOO_SHORT_MESSAGE);
    expect(updateUser).not.toHaveBeenCalled();
  });

  it("rejects mismatched passwords", async () => {
    render(<UpdatePasswordExperience email="user@example.com" />);
    await fillAndSubmit("Fensterbank-77x", "Fensterbank-78x");
    expect(screen.getByRole("alert")).toHaveTextContent("stimmen nicht überein");
    expect(updateUser).not.toHaveBeenCalled();
  });

  it.each(["Password123456", "P@ssw0rd2024!"])(
    "weist das bekannte Passwort %s ab, ohne Supabase zu fragen",
    async (password) => {
      render(<UpdatePasswordExperience email="user@example.com" />);
      await fillAndSubmit(password, password);
      expect(screen.getByRole("alert")).toHaveTextContent(/bekannt/);
      expect(updateUser).not.toHaveBeenCalled();
    }
  );

  it("weist ein Passwort mit der eigenen Adresse ab", async () => {
    render(<UpdatePasswordExperience email="kasumbajrami7@example.com" />);
    await fillAndSubmit("xx-kasumbajrami-xx-9", "xx-kasumbajrami-xx-9");
    expect(screen.getByRole("alert")).toHaveTextContent(/E-Mail/);
    expect(updateUser).not.toHaveBeenCalled();
  });

  it("maps a stale-session error to friendly copy", async () => {
    updateUser.mockResolvedValue({ error: { message: "JWT expired" } });
    render(<UpdatePasswordExperience email="user@example.com" />);
    await fillAndSubmit("Fensterbank-77x", "Fensterbank-77x");
    expect(await screen.findByRole("alert")).toHaveTextContent("Sitzung ist abgelaufen");
  });

  it("maps a same-as-old-password error to friendly copy", async () => {
    updateUser.mockResolvedValue({
      error: { message: "New password should be different from the old password" },
    });
    render(<UpdatePasswordExperience email="user@example.com" />);
    await fillAndSubmit("Fensterbank-77x", "Fensterbank-77x");
    expect(await screen.findByRole("alert")).toHaveTextContent("muss sich vom alten unterscheiden");
  });

  // #408: nur bekannte Fehler bekommen ihren Satz, der Wortlaut von Supabase und Browser erscheint nie.
  const HTML_PARSE_ERROR = 'Unexpected token \'<\', "<!DOCTYPE "... is not valid JSON';

  it.each([
    [
      "ohne Verbindung (Status 0, so meldet es Supabase)",
      { message: "Failed to fetch", name: "AuthRetryableFetchError", status: 0 },
      "Keine Verbindung zum Server",
    ],
    ["bei einem 504", { message: "Gateway Timeout", name: "AuthRetryableFetchError", status: 504 }, "Das hat gerade nicht geklappt"],
    ["bei einer HTML-Antwort", { message: HTML_PARSE_ERROR, name: "AuthUnknownError" }, "Das hat gerade nicht geklappt"],
    ["bei einem unbekannten Fehler", { message: "Database error querying schema", status: 500 }, "Das hat gerade nicht geklappt"],
    [
      "bei einem als schwach bekannten Passwort",
      { message: "Password is known to be weak and easy to guess, please choose a different one.", status: 422 },
      "Dieses Passwort ist zu schwach",
    ],
    ["bei einem zu langen Passwort", { message: "Password cannot be longer than 72 characters", status: 400 }, "höchstens 72 Zeichen"],
  ])("zeigt %s einen deutschen Satz", async (_name, updateError, expected) => {
    updateUser.mockResolvedValue({ error: updateError });
    render(<UpdatePasswordExperience email="user@example.com" />);
    await fillAndSubmit("Fensterbank-77x", "Fensterbank-77x");

    expect(await screen.findByRole("alert")).toHaveTextContent(expected);
    expect(screen.getByRole("alert")).not.toHaveTextContent(updateError.message);
  });

  it.each([
    ["einem TypeError", new TypeError("Failed to fetch"), "Keine Verbindung zum Server"],
    ["etwas anderem", new Error("boom"), "Das hat gerade nicht geklappt"],
  ])("zeigt auch bei %s, das geworfen wird, nur den deutschen Satz", async (_name, thrown, expected) => {
    updateUser.mockRejectedValue(thrown);
    render(<UpdatePasswordExperience email="user@example.com" />);
    await fillAndSubmit("Fensterbank-77x", "Fensterbank-77x");

    expect(await screen.findByRole("alert")).toHaveTextContent(expected);
    expect(screen.getByRole("alert")).not.toHaveTextContent(thrown.message);
  });

  it("celebrates and redirects to /chats/new on success", async () => {
    updateUser.mockResolvedValue({ error: null });
    render(<UpdatePasswordExperience email="user@example.com" />);
    await fillAndSubmit("Fensterbank-77x", "Fensterbank-77x");

    expect(updateUser).toHaveBeenCalledWith({ password: "Fensterbank-77x" });
    expect(await screen.findByRole("status")).toHaveTextContent("Passwort aktualisiert");

    await userEvent.setup().click(screen.getByRole("button", { name: "weiter" }));
    expect(push).toHaveBeenCalledWith("/chats/new");
    expect(refresh).toHaveBeenCalled();
  });

  // Die Seite rendert das Formular auf dem Server, React hydriert danach: was bis dahin in beiden Feldern stand
  // (getippt oder vom Passwort-Manager vorgeschlagen), übernimmt sie (lib/prefilled-input.ts).
  it("übernimmt beide Passwörter von vor dem Hydrieren", async () => {
    updateUser.mockResolvedValue({ error: null });
    const { hydrationErrors } = await renderStaticPage(<UpdatePasswordExperience email="user@example.com" />, {
      url: "/reset-password/update",
      beforeHydration: (container) => {
        fillBeforeHydration(container, "#new-password", "Fensterbank-77x");
        fillBeforeHydration(container, "#confirm-password", "Fensterbank-77x");
      },
    });
    expect(hydrationErrors).toEqual([]);
    fireEvent.submit(screen.getByPlaceholderText("Passwort wiederholen").closest("form")!);

    expect(updateUser).toHaveBeenCalledWith({ password: "Fensterbank-77x" });
    expect(await screen.findByRole("status")).toHaveTextContent("Passwort aktualisiert");
  });

  it("übernimmt jedes Feld in seinen eigenen State", async () => {
    await renderStaticPage(<UpdatePasswordExperience email="user@example.com" />, {
      url: "/reset-password/update",
      beforeHydration: (container) => {
        fillBeforeHydration(container, "#new-password", "Fensterbank-77x");
        fillBeforeHydration(container, "#confirm-password", "Fensterbank-78x");
      },
    });
    fireEvent.submit(screen.getByPlaceholderText("Passwort wiederholen").closest("form")!);

    expect(screen.getByRole("alert")).toHaveTextContent("stimmen nicht überein");
    expect(updateUser).not.toHaveBeenCalled();
    expect(screen.getByPlaceholderText(`Neues Passwort (mind. ${MIN_PASSWORD_LENGTH} Zeichen)`)).toHaveValue("Fensterbank-77x");
    expect(screen.getByPlaceholderText("Passwort wiederholen")).toHaveValue("Fensterbank-78x");
  });
});
