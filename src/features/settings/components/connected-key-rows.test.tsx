import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ConnectedCustomRow, ConnectedProviderRow } from "./connected-key-rows";

// Die Zeilen liegen seit der Zerlegung von api-keys.tsx (Betriebs-Audit, Folgesitzung 2026-10-07, Dateigröße) in
// connected-key-rows.tsx. Das Verhalten im Zusammenspiel prüft api-keys.rows.test.tsx über ApiKeys; hier steht,
// dass beide auch allein tragen.

const refresh = vi.fn();
const toast = vi.fn();
const fetchMock = vi.fn();

vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh }) }));
vi.mock("@/shared/ui/toast", () => ({ useToast: () => ({ toast }) }));

beforeEach(() => {
  refresh.mockReset();
  toast.mockReset();
  fetchMock.mockReset().mockResolvedValue({ ok: true, status: 200, json: async () => ({}) } as Response);
  vi.stubGlobal("fetch", fetchMock);
});

describe("ConnectedProviderRow", () => {
  it("zeigt den Anbieter und entfernt ihn über DELETE", async () => {
    render(<ConnectedProviderRow provider="openai" isActive={false} canActivate />);
    expect(screen.getByText("OpenAI")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Aktivieren" })).toBeInTheDocument();

    await userEvent.setup().click(screen.getByRole("button", { name: "OpenAI-Key entfernen" }));

    await waitFor(() => expect(refresh).toHaveBeenCalledTimes(1));
    expect(fetchMock.mock.calls[0][0]).toBe("/api/settings/api-key?provider=openai");
  });
});

describe("ConnectedCustomRow", () => {
  it("zeigt Name und Modell und entfernt den Endpunkt über DELETE auf custom", async () => {
    render(<ConnectedCustomRow meta={{ label: "Groq", baseUrl: "https://api.groq.com", model: "llama-3" }} />);
    expect(screen.getByText("Groq")).toBeInTheDocument();
    expect(screen.getByText("llama-3")).toBeInTheDocument();

    await userEvent.setup().click(screen.getByRole("button", { name: "Custom-Key entfernen" }));

    await waitFor(() => expect(refresh).toHaveBeenCalledTimes(1));
    expect(fetchMock.mock.calls[0][0]).toBe("/api/settings/api-key?provider=custom");
  });
});
