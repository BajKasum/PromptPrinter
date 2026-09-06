import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import UpdatePasswordPage from "./page";

// M-7 (Audit 06.09.2026): getUser() bestaetigt nur "irgendeine gueltige
// Sitzung", nicht dass sie aus einem Recovery-Link stammt. Wer aus einem
// anderen Grund eine Sitzung hat, konnte damit das Passwort ohne das alte
// zu kennen und ohne Postfachzugriff aendern.
const getUser = vi.fn();
const getClaims = vi.fn();

vi.mock("@/server/supabase/server", () => ({
  createClient: async () => ({ auth: { getUser, getClaims } }),
}));

vi.mock("@/features/auth/components/update-password-experience", () => ({
  UpdatePasswordExperience: ({ email }: { email: string }) => (
    <div data-testid="update-password-experience">{email}</div>
  ),
}));

describe("UpdatePasswordPage", () => {
  it("zeigt das Formular, wenn die Sitzung aus einem Recovery-Link stammt", async () => {
    getUser.mockResolvedValue({ data: { user: { email: "kasum@example.test" } } });
    getClaims.mockResolvedValue({
      data: { claims: { amr: [{ method: "recovery", timestamp: 1 }] } },
      error: null,
    });

    render(await UpdatePasswordPage());

    expect(screen.getByTestId("update-password-experience")).toHaveTextContent(
      "kasum@example.test"
    );
  });

  it("zeigt den Fehler, wenn es gar keine Sitzung gibt", async () => {
    getUser.mockResolvedValue({ data: { user: null } });
    getClaims.mockResolvedValue({ data: null, error: { message: "no session" } });

    render(await UpdatePasswordPage());

    expect(screen.getByText("Link ungültig oder abgelaufen")).toBeInTheDocument();
    expect(screen.queryByTestId("update-password-experience")).not.toBeInTheDocument();
  });

  // Der eigentliche Fund: eine Sitzung existiert, kam aber nicht aus einem
  // Recovery-Link (z.B. ein gewoehnlicher eingeloggter Besucher, der diese
  // URL direkt aufruft).
  it("zeigt den Fehler, wenn eine Sitzung existiert, aber ohne Recovery-AMR", async () => {
    getUser.mockResolvedValue({ data: { user: { email: "kasum@example.test" } } });
    getClaims.mockResolvedValue({
      data: { claims: { amr: [{ method: "password", timestamp: 1 }] } },
      error: null,
    });

    render(await UpdatePasswordPage());

    expect(screen.getByText("Link ungültig oder abgelaufen")).toBeInTheDocument();
    expect(screen.queryByTestId("update-password-experience")).not.toBeInTheDocument();
  });

  it("akzeptiert auch das RFC-8176-Stringformat der AMR-Liste", async () => {
    getUser.mockResolvedValue({ data: { user: { email: "kasum@example.test" } } });
    getClaims.mockResolvedValue({
      data: { claims: { amr: ["recovery"] } },
      error: null,
    });

    render(await UpdatePasswordPage());

    expect(screen.getByTestId("update-password-experience")).toBeInTheDocument();
  });
});
