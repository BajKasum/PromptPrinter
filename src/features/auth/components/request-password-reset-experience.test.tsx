import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { RequestPasswordResetExperience } from "./request-password-reset-experience";
import { fillBeforeHydration, renderStaticPage, serverHtml } from "@tests/support/static-page";

const postAuthAction = vi.fn();

// Das Formular schickt an /api/auth (Turnstile wird dort eingelöst); geprüft wird, was es SENDET und wie es die
// Antwort zeigt.
vi.mock("@/shared/lib/auth-client", () => ({
  postAuthAction: (...args: unknown[]) => postAuthAction(...args),
}));

vi.mock("@/features/auth/components/auth-experience-shell", () => ({
  AuthExperienceShell: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));

const form = () => screen.getByPlaceholderText("du@example.com").closest("form")!;

describe("RequestPasswordResetExperience", () => {
  beforeEach(() => {
    postAuthAction.mockReset();
    postAuthAction.mockResolvedValue({ ok: true });
  });

  it("weist eine ungültige Adresse ab, ohne die Route zu rufen", async () => {
    render(<RequestPasswordResetExperience />);
    await userEvent.setup().type(screen.getByPlaceholderText("du@example.com"), "keine-adresse");
    fireEvent.submit(form());
    expect(screen.getByRole("alert")).toHaveTextContent("gültige Email");
    expect(postAuthAction).not.toHaveBeenCalled();
  });

  it("schickt die Adresse und zeigt danach den Hinweis auf die Mail", async () => {
    render(<RequestPasswordResetExperience />);
    await userEvent.setup().type(screen.getByPlaceholderText("du@example.com"), "user@example.com");
    fireEvent.submit(form());
    expect(postAuthAction).toHaveBeenCalledWith({ action: "reset-password", email: "user@example.com" }, null);
    expect(await screen.findByText("Email unterwegs")).toBeInTheDocument();
  });

  // /reset-password ist statisch vorgerendert: das Formular steht im HTML, und was bis zum Hydrieren eingetragen
  // wurde, übernimmt die Seite danach (lib/prefilled-input.ts).
  describe("statisch vorgerendert", () => {
    it("liefert das Formular im Server-HTML", () => {
      const html = serverHtml(<RequestPasswordResetExperience />, "/reset-password");
      expect(html).toContain("Passwort vergessen?");
      expect(html).toContain('id="reset-email"');
    });

    it("übernimmt eine vor dem Hydrieren eingetragene Adresse", async () => {
      const { hydrationErrors } = await renderStaticPage(<RequestPasswordResetExperience />, {
        url: "/reset-password",
        beforeHydration: (container) => fillBeforeHydration(container, "#reset-email", "user@example.com"),
      });
      expect(hydrationErrors).toEqual([]);
      fireEvent.submit(form());

      expect(postAuthAction).toHaveBeenCalledWith({ action: "reset-password", email: "user@example.com" }, null);
      expect(await screen.findByText("user@example.com")).toBeInTheDocument();
    });
  });
});
