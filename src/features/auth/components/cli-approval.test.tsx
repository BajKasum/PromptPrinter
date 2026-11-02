import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { CliApproval } from "./cli-approval";

const fetchMock = vi.fn();

function reply(status: number, body: unknown) {
  return { ok: status >= 200 && status < 300, status, json: async () => body };
}

const PENDING = {
  clientName: "pp auf Laptop",
  createdAt: "2026-10-29T10:15:00Z",
  ip: "203.0.113.7",
  location: "Basel, CH",
  userAgent: "promptprinter-cli/1.0",
  sameAddress: true,
  maxAgeDays: 30,
};

beforeEach(() => {
  vi.clearAllMocks();
  vi.stubGlobal("fetch", fetchMock);
  fetchMock.mockResolvedValue(reply(200, PENDING));
});
afterEach(() => vi.unstubAllGlobals());

async function typeCode(value: string) {
  const user = userEvent.setup();
  const input = screen.getByLabelText("Code aus dem Terminal");
  await user.click(input);
  await user.paste(value);
  return user;
}

function lastBody() {
  return JSON.parse(fetchMock.mock.calls.at(-1)![1].body as string);
}

describe("CliApproval (Bestätigungsseite der Terminal-Anmeldung)", () => {
  it("füllt den Code nie aus der Adresse vor", () => {
    window.history.pushState({}, "", "/cli?code=BCDF-GHJK&user_code=BCDFGHJK#BCDFGHJK");
    render(<CliApproval />);

    expect(screen.getByLabelText("Code aus dem Terminal")).toHaveValue("");
    expect(screen.getByRole("button", { name: "Weiter" })).toBeDisabled();
    window.history.pushState({}, "", "/");
  });

  it("zeigt beim Tippen nur erlaubte Zeichen in zwei Vierergruppen und lässt erst den vollständigen Code weiter", async () => {
    render(<CliApproval />);
    const user = await typeCode("bcdf ghja!");

    // "A" (Vokal), Leerzeichen und "!" fallen weg, der Rest steht in Großbuchstaben.
    expect(screen.getByLabelText("Code aus dem Terminal")).toHaveValue("BCDF-GHJ");
    expect(screen.getByRole("button", { name: "Weiter" })).toBeDisabled();

    await user.type(screen.getByLabelText("Code aus dem Terminal"), "k");
    expect(screen.getByLabelText("Code aus dem Terminal")).toHaveValue("BCDF-GHJK");
    expect(screen.getByRole("button", { name: "Weiter" })).toBeEnabled();
  });

  it("zeigt, woher die Anfrage kommt: den Namen wählt der Anfragende selbst", async () => {
    render(<CliApproval />);
    const user = await typeCode("BCDFGHJK");
    await user.click(screen.getByRole("button", { name: "Weiter" }));

    await screen.findByText("pp auf Laptop");
    expect(screen.getByText("Adresse").nextSibling).toHaveTextContent("203.0.113.7");
    expect(screen.getByText("Ort, ungefähr").nextSibling).toHaveTextContent("Basel, CH");
    expect(screen.getByText("Programm").nextSibling).toHaveTextContent("promptprinter-cli/1.0");
    expect(screen.getByText(/höchstens 30 Tage angemeldet/)).toBeInTheDocument();
    expect(screen.queryByText(/anderen Adresse als dein Browser/)).not.toBeInTheDocument();
  });

  it("warnt, wenn die Anfrage von einer anderen Adresse kommt als der Browser", async () => {
    fetchMock.mockResolvedValue(reply(200, { ...PENDING, sameAddress: false }));
    render(<CliApproval />);
    const user = await typeCode("BCDFGHJK");
    await user.click(screen.getByRole("button", { name: "Weiter" }));

    expect(await screen.findByText(/anderen Adresse als dein Browser/)).toBeInTheDocument();
  });

  it("lässt weg, was die Anfrage nicht trägt, und warnt ohne Adresse nicht", async () => {
    fetchMock.mockResolvedValue(
      reply(200, { clientName: "pp", createdAt: PENDING.createdAt, ip: null, location: null, userAgent: null, sameAddress: null })
    );
    render(<CliApproval />);
    const user = await typeCode("BCDFGHJK");
    await user.click(screen.getByRole("button", { name: "Weiter" }));

    await screen.findByText("pp");
    for (const label of ["Adresse", "Ort, ungefähr", "Programm"]) expect(screen.queryByText(label)).not.toBeInTheDocument();
    expect(screen.queryByText(/anderen Adresse als dein Browser/)).not.toBeInTheDocument();
  });

  it("zeigt Gerätename, Uhrzeit und die Warnung, bevor etwas entschieden wird", async () => {
    render(<CliApproval />);
    const user = await typeCode("BCDFGHJK");
    await user.click(screen.getByRole("button", { name: "Weiter" }));

    expect(await screen.findByText("pp auf Laptop")).toBeInTheDocument();
    expect(screen.getByText(/Angefragt um/)).toBeInTheDocument();
    expect(screen.getByRole("note").textContent).toBe("Nur bestätigen, wenn du den Befehl gerade selbst gestartet hast.");
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(lastBody()).toEqual({ userCode: "BCDFGHJK", action: "lookup" });
  });

  it("Anmelden sendet approve, Ablehnen sendet deny", async () => {
    render(<CliApproval />);
    const user = await typeCode("BCDFGHJK");
    await user.click(screen.getByRole("button", { name: "Weiter" }));
    await screen.findByText("pp auf Laptop");

    fetchMock.mockResolvedValue(reply(200, { ok: true, status: "approved" }));
    await user.click(screen.getByRole("button", { name: "Terminal anmelden" }));
    await waitFor(() => expect(screen.getByRole("status").textContent).toContain("Dein Terminal ist angemeldet"));
    expect(lastBody()).toEqual({ userCode: "BCDFGHJK", action: "approve" });
  });

  it("Ablehnen sendet deny und sagt, dass das Terminal keinen Zugang bekommt", async () => {
    render(<CliApproval />);
    const user = await typeCode("BCDFGHJK");
    await user.click(screen.getByRole("button", { name: "Weiter" }));
    await screen.findByText("pp auf Laptop");

    fetchMock.mockResolvedValue(reply(200, { ok: true, status: "denied" }));
    await user.click(screen.getByRole("button", { name: "Ablehnen" }));
    await waitFor(() => expect(screen.getByRole("status").textContent).toContain("keinen Zugang"));
    expect(lastBody()).toEqual({ userCode: "BCDFGHJK", action: "deny" });
  });

  it("ein unbekannter oder abgelaufener Code zeigt den Satz des Servers und bleibt bei der Eingabe", async () => {
    fetchMock.mockResolvedValue(reply(404, { detail: "Diesen Code kenne ich nicht, oder er ist abgelaufen." }));
    render(<CliApproval />);
    const user = await typeCode("BCDFGHJK");
    await user.click(screen.getByRole("button", { name: "Weiter" }));

    expect((await screen.findByRole("alert")).textContent).toContain("Diesen Code kenne ich nicht");
    expect(screen.getByLabelText("Code aus dem Terminal")).toBeInTheDocument();
  });

  it("scheitert die Verbindung, steht ein Hinweis da und nichts wurde entschieden", async () => {
    fetchMock.mockRejectedValue(new Error("offline"));
    render(<CliApproval />);
    const user = await typeCode("BCDFGHJK");
    await user.click(screen.getByRole("button", { name: "Weiter" }));

    expect((await screen.findByRole("alert")).textContent).toContain("Das hat nicht geklappt");
  });
});
