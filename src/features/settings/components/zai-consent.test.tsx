import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ZaiConsent } from "./zai-consent";

const fetchMock = vi.fn();

describe("ZaiConsent (Einstellungen)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubGlobal("fetch", fetchMock);
    fetchMock.mockResolvedValue({ ok: true, json: async () => ({ ok: true }) });
  });
  afterEach(() => vi.unstubAllGlobals());

  it("zeigt ohne Zustimmung den Hinweis und bietet Zustimmen an", () => {
    render(<ZaiConsent consentAt={null} />);

    expect(screen.getByText(/noch nicht zugestimmt/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Zustimmen" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Zustimmung widerrufen" })).not.toBeInTheDocument();
  });

  it("nennt mit Zustimmung das Datum und bietet den Widerruf an", () => {
    render(<ZaiConsent consentAt="2026-10-17T10:00:00.000Z" />);

    expect(screen.getByText(/zugestimmt, dass deine Nachrichten an Z\.ai in Singapur gehen/)).toBeInTheDocument();
    expect(screen.getByText(/2026/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Zustimmung widerrufen" })).toBeInTheDocument();
  });

  it("Widerrufen ruft DELETE auf, wechselt in den Zustand ohne Zustimmung und sagt, was das heißt", async () => {
    render(<ZaiConsent consentAt="2026-10-17T10:00:00.000Z" />);
    const user = userEvent.setup();

    await user.click(screen.getByRole("button", { name: "Zustimmung widerrufen" }));

    await waitFor(() => expect(screen.getByRole("button", { name: "Zustimmen" })).toBeInTheDocument());
    expect(fetchMock).toHaveBeenCalledWith("/api/consent/zai", { method: "DELETE" });
    expect(screen.getByRole("status").textContent).toContain("nur noch mit deinem eigenen Schlüssel");
  });

  it("Zustimmen ruft POST auf und zeigt danach die Zustimmung", async () => {
    render(<ZaiConsent consentAt={null} />);
    const user = userEvent.setup();

    await user.click(screen.getByRole("button", { name: "Zustimmen" }));

    await waitFor(() => expect(screen.getByRole("button", { name: "Zustimmung widerrufen" })).toBeInTheDocument());
    expect(fetchMock).toHaveBeenCalledWith("/api/consent/zai", { method: "POST" });
  });

  it("ändert bei einem Fehler nichts und meldet ihn", async () => {
    fetchMock.mockResolvedValue({ ok: false, json: async () => ({}) });
    render(<ZaiConsent consentAt="2026-10-17T10:00:00.000Z" />);
    const user = userEvent.setup();

    await user.click(screen.getByRole("button", { name: "Zustimmung widerrufen" }));

    expect(await screen.findByText("Das hat nicht geklappt. Bitte versuch es noch einmal.")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Zustimmung widerrufen" })).toBeInTheDocument();
  });
});
