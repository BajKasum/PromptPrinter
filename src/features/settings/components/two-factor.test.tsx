import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { TwoFactor } from "./two-factor";

const toast = vi.fn();
vi.mock("@/shared/ui/toast", () => ({ useToast: () => ({ toast }) }));

const fetchMock = vi.fn();

function reply(status: number, body: unknown) {
  return { ok: status >= 200 && status < 300, status, json: async () => body };
}

const OFF = { enabled: false, needsVerification: false, recoveryCodesLeft: null };
const ON = { enabled: true, needsVerification: false, recoveryCodesLeft: 7 };
const ENROLLMENT = { factorId: "11111111-1111-4111-8111-111111111111", qrCode: "data:image/svg+xml;utf-8,<svg/>", secret: "GEHEIM234" };
const CODES = ["BCDF-GHJK-LMNP-QRST", "VWXZ-2345-6789-BCDF"];

type Answer = { status: number; body: unknown };

/** Die Antworten je Aktion, GET liefert den Status. */
function server(status: unknown, answers: Record<string, Answer> = {}) {
  fetchMock.mockImplementation(async (_url: string, init?: RequestInit) => {
    if (!init) return reply(200, status);
    const { action } = JSON.parse(init.body as string) as { action: string };
    const answer = answers[action] ?? { status: 200, body: { ok: true } };
    return reply(answer.status, answer.body);
  });
}

const sent = () =>
  fetchMock.mock.calls.filter(([, init]) => init).map(([, init]) => JSON.parse((init as RequestInit).body as string));

beforeEach(() => {
  vi.clearAllMocks();
  vi.stubGlobal("fetch", fetchMock);
});
afterEach(() => vi.unstubAllGlobals());

describe("TwoFactor", () => {
  it("führt durchs Einrichten: QR-Code und Schlüssel, Code aus der App, dann die Codes einmal", async () => {
    server(OFF, { enroll: { status: 200, body: ENROLLMENT }, activate: { status: 200, body: { recoveryCodes: CODES } } });
    render(<TwoFactor />);
    const user = userEvent.setup();

    await user.click(await screen.findByRole("button", { name: "Einrichten" }));
    expect(await screen.findByRole("img", { name: /QR-Code/ })).toHaveAttribute("src", ENROLLMENT.qrCode);
    expect(screen.getByTestId("totp-secret")).toHaveTextContent("GEHEIM234");
    expect(screen.getByRole("button", { name: "Bestätigen" })).toBeDisabled();

    await user.type(screen.getByLabelText("Code aus der App"), "123456");
    await user.click(screen.getByRole("button", { name: "Bestätigen" }));

    const list = await screen.findByTestId("recovery-codes");
    for (const code of CODES) expect(within(list).getByText(code)).toBeInTheDocument();
    expect(sent().at(-1)).toEqual({ action: "activate", factorId: ENROLLMENT.factorId, code: "123456" });

    await user.click(screen.getByRole("button", { name: "Ich habe sie gesichert" }));
    expect(screen.queryByTestId("recovery-codes")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Ausschalten" })).toBeInTheDocument();
    expect(screen.getByText(/2 Wiederherstellungscodes übrig/)).toBeInTheDocument();
  });

  it("sagt es, wenn der Faktor aktiv ist, die Codes aber nicht entstanden", async () => {
    server(OFF, { enroll: { status: 200, body: ENROLLMENT }, activate: { status: 200, body: { recoveryCodes: null } } });
    render(<TwoFactor />);
    const user = userEvent.setup();
    await user.click(await screen.findByRole("button", { name: "Einrichten" }));
    await user.type(await screen.findByLabelText("Code aus der App"), "123456");
    await user.click(screen.getByRole("button", { name: "Bestätigen" }));
    expect(await screen.findByRole("alert")).toHaveTextContent(/neue Codes/);
  });

  it("bleibt beim falschen Code in der Eingabe und zeigt die Meldung", async () => {
    server(OFF, { enroll: { status: 200, body: ENROLLMENT }, activate: { status: 400, body: { detail: "Dieser Code stimmt nicht." } } });
    render(<TwoFactor />);
    const user = userEvent.setup();
    await user.click(await screen.findByRole("button", { name: "Einrichten" }));
    await user.type(await screen.findByLabelText("Code aus der App"), "000000");
    await user.click(screen.getByRole("button", { name: "Bestätigen" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("Dieser Code stimmt nicht.");
    expect(screen.getByTestId("totp-secret")).toBeInTheDocument();
  });

  it("zeigt im Betrieb die übrigen Codes und den Hinweis zu den Terminals", async () => {
    server(ON);
    render(<TwoFactor />);
    expect(await screen.findByText(/7 Wiederherstellungscodes übrig/)).toBeInTheDocument();
    expect(screen.getByText(/meldet deine Terminals ab/)).toBeInTheDocument();
  });

  it("schaltet nur mit einem Code aus der App aus", async () => {
    server(ON);
    render(<TwoFactor />);
    const user = userEvent.setup();
    await user.click(await screen.findByRole("button", { name: "Ausschalten" }));
    expect(sent()).toEqual([]);

    await user.type(screen.getByLabelText("Code aus der App"), "123456");
    await user.click(screen.getByRole("button", { name: "Bestätigen" }));

    await waitFor(() => expect(sent()).toEqual([{ action: "disable", code: "123456" }]));
    expect(await screen.findByRole("button", { name: "Einrichten" })).toBeInTheDocument();
    expect(toast).toHaveBeenCalledWith({ title: "Der zweite Faktor ist aus.", variant: "success" });
  });

  it("erneuert die Codes nur mit einem Code aus der App und zeigt sie einmal", async () => {
    server(ON, { "renew-codes": { status: 200, body: { recoveryCodes: CODES } } });
    render(<TwoFactor />);
    const user = userEvent.setup();
    await user.click(await screen.findByRole("button", { name: "Neue Codes" }));
    await user.type(screen.getByLabelText("Code aus der App"), "123456");
    await user.click(screen.getByRole("button", { name: "Bestätigen" }));
    expect(await screen.findByTestId("recovery-codes")).toBeInTheDocument();
    expect(sent()).toEqual([{ action: "renew-codes", code: "123456" }]);
  });

  it("zeigt ohne lesbaren Status keine Schalter", async () => {
    fetchMock.mockResolvedValue(reply(503, {}));
    render(<TwoFactor />);
    await waitFor(() => expect(fetchMock).toHaveBeenCalled());
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
  });
});
