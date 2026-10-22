import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { DeleteAccount } from "./delete-account";
import { de } from "@/shared/i18n/messages/de";

// #132: der Server verlangt für "Konto löschen" eine frische Anmeldung und antwortet bei einer alten Sitzung mit
// 403 und `code: "reauth_required"`. Der Dialog zeigt dann statt des Eingabefelds den Grund und führt zur
// erneuten Anmeldung. Hier zählt vor allem, dass er in diesem Fall NICHT als gewöhnlicher Fehler endet.

const toast = vi.fn();
const signOut = vi.fn();
const fetchMock = vi.fn();

vi.mock("@/shared/ui/toast", () => ({ useToast: () => ({ toast }) }));
vi.mock("@/shared/supabase/client", () => ({ createClient: () => ({ auth: { signOut } }) }));

const EMAIL = "anna@example.test";
const originalLocation = window.location;

function response(status: number, body: unknown) {
  return { ok: status < 400, status, json: async () => body } as Response;
}

async function openAndConfirm() {
  const user = userEvent.setup();
  render(<DeleteAccount email={EMAIL} />);
  await user.click(screen.getByRole("button", { name: de.common.delete }));
  const dialog = await screen.findByRole("dialog");
  await user.type(within(dialog).getByPlaceholderText(EMAIL), EMAIL);
  await user.click(within(dialog).getByRole("button", { name: de.settings.deleteAccount.title }));
  return { user, dialog };
}

beforeEach(() => {
  toast.mockReset();
  signOut.mockReset();
  signOut.mockResolvedValue({ error: null });
  fetchMock.mockReset();
  vi.stubGlobal("fetch", fetchMock);
  Object.defineProperty(window, "location", { configurable: true, writable: true, value: { href: "/settings" } });
});

afterEach(() => {
  vi.unstubAllGlobals();
  Object.defineProperty(window, "location", { configurable: true, writable: true, value: originalLocation });
});

describe("DeleteAccount: alte Sitzung", () => {
  it("zeigt den Grund statt des Eingabefelds und bietet die erneute Anmeldung an, ohne Fehler-Toast", async () => {
    fetchMock.mockResolvedValue(
      response(403, { detail: "Bitte melde dich erneut an.", code: "reauth_required" })
    );
    const { dialog } = await openAndConfirm();

    expect(fetchMock).toHaveBeenCalledWith("/api/account", { method: "DELETE" });
    expect(await within(dialog).findByRole("alert")).toHaveTextContent(de.settings.deleteAccount.reauthBody);
    expect(within(dialog).queryByPlaceholderText(EMAIL)).not.toBeInTheDocument();
    expect(within(dialog).queryByRole("button", { name: de.settings.deleteAccount.title })).not.toBeInTheDocument();
    expect(within(dialog).getByRole("button", { name: de.settings.deleteAccount.reauthAction })).toBeEnabled();
    expect(toast).not.toHaveBeenCalled();
  });

  it("Neu anmelden beendet nur diese Sitzung und führt zur Anmeldung, die in die Einstellungen zurückkehrt", async () => {
    fetchMock.mockResolvedValue(response(403, { detail: "x", code: "reauth_required" }));
    const { user, dialog } = await openAndConfirm();

    await user.click(await within(dialog).findByRole("button", { name: de.settings.deleteAccount.reauthAction }));

    await waitFor(() => expect(window.location.href).toBe("/login?next=%2Fsettings"));
    // "local": die anderen Geräte bleiben angemeldet.
    expect(signOut).toHaveBeenCalledWith({ scope: "local" });
    // Gelöscht wurde nichts, es gab genau den einen Aufruf.
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("geht auch zur Anmeldung, wenn das Abmelden scheitert", async () => {
    signOut.mockRejectedValue(new Error("offline"));
    fetchMock.mockResolvedValue(response(403, { detail: "x", code: "reauth_required" }));
    const { user, dialog } = await openAndConfirm();

    await user.click(await within(dialog).findByRole("button", { name: de.settings.deleteAccount.reauthAction }));
    await waitFor(() => expect(window.location.href).toBe("/login?next=%2Fsettings"));
  });

  it("beim nächsten Öffnen ist wieder das Eingabefeld da", async () => {
    fetchMock.mockResolvedValue(response(403, { detail: "x", code: "reauth_required" }));
    const { user, dialog } = await openAndConfirm();
    await within(dialog).findByRole("alert");

    await user.click(within(dialog).getByRole("button", { name: de.common.cancel }));
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
    await user.click(screen.getByRole("button", { name: de.common.delete }));
    expect(await screen.findByPlaceholderText(EMAIL)).toBeInTheDocument();
  });
});

describe("DeleteAccount: andere Antworten", () => {
  it("ein anderer 403 (ohne Code) bleibt ein gewöhnlicher Fehler mit Toast und offenem Eingabefeld", async () => {
    fetchMock.mockResolvedValue(response(403, { detail: "Verboten." }));
    const { dialog } = await openAndConfirm();

    await waitFor(() => expect(toast).toHaveBeenCalled());
    expect(toast.mock.calls[0][0]).toMatchObject({ variant: "error", description: "Verboten." });
    expect(within(dialog).queryByRole("alert")).not.toBeInTheDocument();
    expect(within(dialog).getByPlaceholderText(EMAIL)).toBeInTheDocument();
  });

  it("bei Erfolg geht es auf die Startseite", async () => {
    fetchMock.mockResolvedValue(response(200, { ok: true }));
    await openAndConfirm();
    await waitFor(() => expect(window.location.href).toBe("/"));
    expect(signOut).not.toHaveBeenCalled();
  });
});
