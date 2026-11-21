import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

const replace = vi.fn();
const refresh = vi.fn();
const router = { replace, refresh };
const visit = (url: string) => window.history.replaceState(null, "", url);
// Ohne `useSearchParams`: die Seite liest die Adresse selbst (lib/location-search.ts).
vi.mock("next/navigation", () => ({
  useRouter: () => router,
}));
vi.mock("@/features/auth/components/auth-experience-shell", () => ({
  AuthExperienceShell: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));
const signOut = vi.fn();
vi.mock("@/shared/supabase/client", () => ({ createClient: () => ({ auth: { signOut } }) }));

import { SecondFactorExperience } from "./second-factor-experience";
import { fillBeforeHydration, renderStaticPage, serverHtml } from "@tests/support/static-page";

const fetchMock = vi.fn();

function reply(status: number, body: unknown) {
  return { ok: status >= 200 && status < 300, status, json: async () => body };
}

const needsCode = reply(200, { enabled: true, needsVerification: true, recoveryCodesLeft: null });

beforeEach(() => {
  vi.clearAllMocks();
  visit("/login/zweiter-faktor?next=/settings");
  vi.stubGlobal("fetch", fetchMock);
  fetchMock.mockImplementation(async (_url: string, init?: RequestInit) => (init ? reply(200, { ok: true }) : needsCode));
});
afterEach(() => vi.unstubAllGlobals());

const lastBody = () => JSON.parse(fetchMock.mock.calls.at(-1)![1].body as string);

describe("SecondFactorExperience", () => {
  it("nimmt nur Ziffern und lässt erst sechs davon los", async () => {
    render(<SecondFactorExperience />);
    const user = userEvent.setup();
    const input = screen.getByLabelText("Code aus der App");
    await user.type(input, "12a3");
    expect(input).toHaveValue("123");
    expect(screen.getByRole("button", { name: "Bestätigen" })).toBeDisabled();
    await user.type(input, "456789");
    expect(input).toHaveValue("123456");
    expect(screen.getByRole("button", { name: "Bestätigen" })).toBeEnabled();
  });

  it("schickt den Code und geht danach an das Ziel", async () => {
    render(<SecondFactorExperience />);
    const user = userEvent.setup();
    await user.type(screen.getByLabelText("Code aus der App"), "123456");
    await user.click(screen.getByRole("button", { name: "Bestätigen" }));

    await waitFor(() => expect(replace).toHaveBeenCalledWith("/settings"));
    expect(lastBody()).toEqual({ action: "verify", code: "123456" });
    expect(refresh).toHaveBeenCalled();
  });

  it("zeigt die Meldung des Servers und bleibt stehen", async () => {
    fetchMock.mockImplementation(async (_url: string, init?: RequestInit) =>
      init ? reply(400, { detail: "Dieser Code stimmt nicht." }) : needsCode
    );
    render(<SecondFactorExperience />);
    const user = userEvent.setup();
    await user.type(screen.getByLabelText("Code aus der App"), "000000");
    await user.click(screen.getByRole("button", { name: "Bestätigen" }));

    expect(await screen.findByRole("alert")).toHaveTextContent("Dieser Code stimmt nicht.");
    expect(replace).not.toHaveBeenCalled();
  });

  it("führt ohne Gerät zum Wiederherstellungscode und zum Kontakt", async () => {
    render(<SecondFactorExperience />);
    const user = userEvent.setup();
    await user.click(screen.getByRole("button", { name: /Gerät verloren/ }));

    expect(screen.getByRole("link", { name: "Kontaktformular" })).toHaveAttribute("href", "/kontakt");
    await user.type(screen.getByLabelText("Wiederherstellungscode"), "BCDF-GHJK-LMNP-QRST");
    await user.click(screen.getByRole("button", { name: "Code einlösen" }));

    await waitFor(() => expect(replace).toHaveBeenCalledWith("/settings"));
    expect(lastBody()).toEqual({ action: "recover", recoveryCode: "BCDF-GHJK-LMNP-QRST" });
  });

  it("geht sofort weiter, wenn die Sitzung den Schritt nicht braucht", async () => {
    fetchMock.mockResolvedValue(reply(200, { enabled: true, needsVerification: false, recoveryCodesLeft: 3 }));
    render(<SecondFactorExperience />);
    await waitFor(() => expect(replace).toHaveBeenCalledWith("/settings"));
  });

  it("folgt keiner fremden Adresse", async () => {
    visit("/login/zweiter-faktor?next=" + encodeURIComponent("https://evil.example/"));
    fetchMock.mockResolvedValue(reply(200, { enabled: false, needsVerification: false, recoveryCodesLeft: null }));
    render(<SecondFactorExperience />);
    await waitFor(() => expect(replace).toHaveBeenCalledWith("/chats/new"));
  });

  it("bleibt stehen, wenn der Status nicht zu lesen ist: die Eingabe schadet nicht", async () => {
    fetchMock.mockResolvedValue(reply(503, {}));
    render(<SecondFactorExperience />);
    await waitFor(() => expect(fetchMock).toHaveBeenCalled());
    expect(replace).not.toHaveBeenCalled();
    expect(screen.getByLabelText("Code aus der App")).toBeInTheDocument();
  });

  // /login/zweiter-faktor ist statisch vorgerendert (lib/location-search.ts): das Formular steht im HTML, und ein vor
  // dem Hydrieren eingetippter Code kommt danach in den State (lib/prefilled-input.ts).
  describe("statisch vorgerendert", () => {
    it("liefert das Formular im Server-HTML, ohne die Adresse zu kennen", () => {
      const html = serverHtml(<SecondFactorExperience />, "/login/zweiter-faktor");
      expect(html).toContain("Noch ein Schritt");
      expect(html).toContain('id="mfa-code"');
    });

    it("übernimmt einen vor dem Hydrieren eingetippten Code, nur seine Ziffern", async () => {
      const { hydrationErrors } = await renderStaticPage(<SecondFactorExperience />, {
        url: "/login/zweiter-faktor?next=/settings",
        beforeHydration: (container) => fillBeforeHydration(container, "#mfa-code", "123 456"),
      });
      expect(hydrationErrors).toEqual([]);
      expect(screen.getByLabelText("Code aus der App")).toHaveValue("123456");

      await userEvent.setup().click(screen.getByRole("button", { name: "Bestätigen" }));
      await waitFor(() => expect(replace).toHaveBeenCalledWith("/settings"));
      expect(lastBody()).toEqual({ action: "verify", code: "123456" });
    });
  });
});
