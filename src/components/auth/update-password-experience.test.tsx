import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { UpdatePasswordExperience } from "./update-password-experience";
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
    await fillAndSubmit("password123", "password124");
    expect(screen.getByRole("alert")).toHaveTextContent("stimmen nicht überein");
    expect(updateUser).not.toHaveBeenCalled();
  });

  it("maps a stale-session error to friendly copy", async () => {
    updateUser.mockResolvedValue({ error: { message: "JWT expired" } });
    render(<UpdatePasswordExperience email="user@example.com" />);
    await fillAndSubmit("password123", "password123");
    expect(await screen.findByRole("alert")).toHaveTextContent("Sitzung ist abgelaufen");
  });

  it("maps a same-as-old-password error to friendly copy", async () => {
    updateUser.mockResolvedValue({
      error: { message: "New password should be different from the old password" },
    });
    render(<UpdatePasswordExperience email="user@example.com" />);
    await fillAndSubmit("password123", "password123");
    expect(await screen.findByRole("alert")).toHaveTextContent("muss sich vom alten unterscheiden");
  });

  it("celebrates and redirects to /chats/new on success", async () => {
    updateUser.mockResolvedValue({ error: null });
    render(<UpdatePasswordExperience email="user@example.com" />);
    await fillAndSubmit("password123", "password123");

    expect(updateUser).toHaveBeenCalledWith({ password: "password123" });
    expect(await screen.findByRole("status")).toHaveTextContent("Passwort aktualisiert");

    await userEvent.setup().click(screen.getByRole("button", { name: "weiter" }));
    expect(push).toHaveBeenCalledWith("/chats/new");
    expect(refresh).toHaveBeenCalled();
  });
});
