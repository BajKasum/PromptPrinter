import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { TerminalSessions } from "./terminal-sessions";

const toast = vi.fn();
vi.mock("@/shared/ui/toast", () => ({ useToast: () => ({ toast }) }));

const fetchMock = vi.fn();

function reply(status: number, body: unknown) {
  return { ok: status >= 200 && status < 300, status, json: async () => body };
}

const LAPTOP = {
  id: "11111111-1111-4111-8111-111111111111",
  clientName: "pp auf Laptop",
  createdAt: "2026-11-01T10:00:00Z",
  lastUsedAt: "2026-11-02T10:00:00Z",
  expiresAt: "2026-12-01T10:00:00Z",
};
const NAMELESS = { ...LAPTOP, id: "22222222-2222-4222-8222-222222222222", clientName: "" };

beforeEach(() => {
  vi.clearAllMocks();
  vi.stubGlobal("fetch", fetchMock);
  fetchMock.mockResolvedValue(reply(200, { sessions: [LAPTOP, NAMELESS] }));
});
afterEach(() => vi.unstubAllGlobals());

describe("TerminalSessions", () => {
  it("listet die Terminals mit Name und Daten und nennt, was Abmelden im Kontomenü tut", async () => {
    render(<TerminalSessions />);
    expect(await screen.findByText("pp auf Laptop")).toBeInTheDocument();
    expect(screen.getByText("Terminal ohne Namen")).toBeInTheDocument();
    expect(screen.getAllByText(/Angemeldet am/)).toHaveLength(2);
    expect(screen.getAllByText(/Gilt bis/)).toHaveLength(2);
    expect(screen.getByText(/Abmelden im Kontomenü beendet alle Sitzungen dieses Kontos, auch alle Terminals/)).toBeInTheDocument();
  });

  it("sagt, wenn keins angemeldet ist", async () => {
    fetchMock.mockResolvedValue(reply(200, { sessions: [] }));
    render(<TerminalSessions />);
    expect(await screen.findByText("Gerade ist kein Terminal angemeldet.")).toBeInTheDocument();
  });

  it("sagt, wenn die Liste nicht lädt, statt so zu tun, als wäre sie leer", async () => {
    fetchMock.mockResolvedValue(reply(503, { detail: "weg" }));
    render(<TerminalSessions />);
    expect(await screen.findByRole("status")).toHaveTextContent("Die Liste lässt sich gerade nicht laden.");
    expect(screen.queryByText("Gerade ist kein Terminal angemeldet.")).not.toBeInTheDocument();
  });

  it("meldet genau dieses Gerät ab und nimmt die Zeile weg", async () => {
    render(<TerminalSessions />);
    await screen.findByText("pp auf Laptop");
    fetchMock.mockResolvedValue(reply(200, { ok: true }));

    await userEvent.setup().click(screen.getByRole("button", { name: "Abmelden: pp auf Laptop" }));

    await waitFor(() => expect(screen.queryByText("pp auf Laptop")).not.toBeInTheDocument());
    expect(fetchMock).toHaveBeenLastCalledWith(`/api/cli/sessions?id=${LAPTOP.id}`, { method: "DELETE" });
    expect(screen.getByText("Terminal ohne Namen")).toBeInTheDocument();
    expect(toast).toHaveBeenCalledWith({ title: "Das Terminal ist abgemeldet.", variant: "success" });
  });

  it("eine schon beendete Sitzung (404) verschwindet genauso", async () => {
    render(<TerminalSessions />);
    await screen.findByText("pp auf Laptop");
    fetchMock.mockResolvedValue(reply(404, { kind: "not_found" }));

    await userEvent.setup().click(screen.getByRole("button", { name: "Abmelden: pp auf Laptop" }));

    await waitFor(() => expect(screen.queryByText("pp auf Laptop")).not.toBeInTheDocument());
  });

  it("lässt die Zeile stehen und sagt es, wenn das Abmelden scheitert", async () => {
    render(<TerminalSessions />);
    await screen.findByText("pp auf Laptop");
    fetchMock.mockResolvedValue(reply(503, { kind: "unavailable" }));

    await userEvent.setup().click(screen.getByRole("button", { name: "Abmelden: pp auf Laptop" }));

    await waitFor(() => expect(toast).toHaveBeenCalledWith({ title: expect.stringMatching(/nicht geklappt/), variant: "error" }));
    expect(screen.getByText("pp auf Laptop")).toBeInTheDocument();
  });
});
