import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ApiKeys } from "./api-keys";

const refresh = vi.fn();
const toast = vi.fn();
const fetchMock = vi.fn();

vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh }) }));
vi.mock("@/shared/ui/toast", () => ({ useToast: () => ({ toast }) }));

function jsonResponse(body: unknown, status = 200) {
  return { ok: status < 400, status, json: async () => body } as Response;
}

// Nutzerwunsch (2026-09-06): kein Anbieter-Dropdown mehr, nur ein Feld — der
// Anbieter wird server-seitig aus dem Key-Format erkannt, die UI zeigt nur
// eine Live-Vorschau, verlangt sich aber nie eine explizite Auswahl.
describe("ApiKeys", () => {
  beforeEach(() => {
    refresh.mockReset();
    toast.mockReset();
    fetchMock.mockReset().mockResolvedValue(jsonResponse({ ok: true }));
    vi.stubGlobal("fetch", fetchMock);
  });

  it("fragt nicht nach dem Anbieter — es gibt ein einziges Eingabefeld", () => {
    render(<ApiKeys configured={[]} active={null} customProvider={null} />);
    expect(screen.getByPlaceholderText(/API-Key einfügen/)).toBeInTheDocument();
    expect(screen.queryByText("Anthropic")).not.toBeInTheDocument();
    expect(screen.queryByText("OpenAI")).not.toBeInTheDocument();
  });

  it("zeigt beim Tippen eine Live-Erkennung des Anbieters, ohne selbst zu entscheiden", async () => {
    render(<ApiKeys configured={[]} active={null} customProvider={null} />);
    const user = userEvent.setup();

    await user.type(screen.getByPlaceholderText(/API-Key einfügen/), "sk-ant-abcdef");

    expect(await screen.findByText(/Erkannt: Anthropic/)).toBeInTheDocument();
  });

  it("sendet nur den Key, ohne Anbieter-Feld, an den Server", async () => {
    render(<ApiKeys configured={[]} active={null} customProvider={null} />);
    const user = userEvent.setup();

    await user.type(screen.getByPlaceholderText(/API-Key einfügen/), "sk-ant-abcdef");
    await user.click(screen.getByRole("button", { name: "Key hinzufügen" }));

    await waitFor(() => expect(fetchMock).toHaveBeenCalled());
    const [, init] = fetchMock.mock.calls[0];
    expect(JSON.parse(init.body as string)).toEqual({ apiKey: "sk-ant-abcdef" });
    expect(refresh).toHaveBeenCalled();
  });

  it("weist bei einem nicht erkennbaren Key darauf hin und oeffnet das erweiterte Formular", async () => {
    fetchMock.mockResolvedValue(
      jsonResponse(
        { detail: "Konnte den Anbieter nicht erkennen.", kind: "unknownProvider" },
        400
      )
    );
    render(<ApiKeys configured={[]} active={null} customProvider={null} />);
    const user = userEvent.setup();

    await user.type(screen.getByPlaceholderText(/API-Key einfügen/), "glm-abcdef");
    await user.click(screen.getByRole("button", { name: "Key hinzufügen" }));

    await waitFor(() =>
      expect(screen.getByPlaceholderText("Name (z. B. Z.ai)")).toBeInTheDocument()
    );
  });

  it("zeigt nur Zeilen fuer tatsaechlich verbundene Anbieter, keine leeren Slots", () => {
    render(<ApiKeys configured={["anthropic"]} active="anthropic" customProvider={null} />);
    expect(screen.getByText("Anthropic")).toBeInTheDocument();
    expect(screen.queryByText("OpenAI")).not.toBeInTheDocument();
    expect(screen.queryByText("Google")).not.toBeInTheDocument();
  });

  it("markiert den aktiven Anbieter und bietet fuer weitere ein Aktivieren an", () => {
    render(
      <ApiKeys configured={["anthropic", "openai"]} active="anthropic" customProvider={null} />
    );
    expect(screen.getByText("Aktiv")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Aktivieren" })).toBeInTheDocument();
  });

  it("entfernt einen verbundenen Anbieter", async () => {
    render(<ApiKeys configured={["anthropic"]} active="anthropic" customProvider={null} />);
    const user = userEvent.setup();

    await user.click(screen.getByTestId("remove-anthropic"));

    await waitFor(() => expect(fetchMock).toHaveBeenCalled());
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toContain("provider=anthropic");
    expect(init.method).toBe("DELETE");
  });

  it("zeigt einen bereits verbundenen Custom-Anbieter, ohne den Anderer-Anbieter-Link", () => {
    render(
      <ApiKeys
        configured={["custom"]}
        active="custom"
        customProvider={{ label: "Z.ai", baseUrl: "https://api.z.ai", model: "glm-4.6" }}
      />
    );
    expect(screen.getByText("Z.ai")).toBeInTheDocument();
    expect(screen.queryByText(/Anderer Anbieter/)).not.toBeInTheDocument();
  });

  it("oeffnet das erweiterte Formular ueber den Anderer-Anbieter-Link und speichert vier Felder", async () => {
    render(<ApiKeys configured={[]} active={null} customProvider={null} />);
    const user = userEvent.setup();

    await user.click(screen.getByText(/Anderer Anbieter/));
    await user.type(screen.getByPlaceholderText("Name (z. B. Z.ai)"), "Z.ai");
    await user.type(screen.getByPlaceholderText("Modell (z. B. glm-4.6)"), "glm-4.6");
    await user.type(
      screen.getByPlaceholderText(/API-Endpoint/),
      "https://api.z.ai/api/paas/v4/chat/completions"
    );
    await user.type(screen.getByPlaceholderText("API-Key"), "custom-key");
    await user.click(screen.getByRole("button", { name: "Speichern" }));

    await waitFor(() => expect(fetchMock).toHaveBeenCalled());
    const [, init] = fetchMock.mock.calls[0];
    expect(JSON.parse(init.body as string)).toEqual({
      provider: "custom",
      label: "Z.ai",
      baseUrl: "https://api.z.ai/api/paas/v4/chat/completions",
      model: "glm-4.6",
      apiKey: "custom-key",
    });
  });
});
