import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ApiKeys } from "./api-keys";

// Die Zeilen der verbundenen Anbieter (Aktivieren, Entfernen, gesperrt während einer Anfrage) und die Zeile des
// eigenen Endpunkts: festgenagelt vor der Zerlegung von api-keys.tsx (Betriebs-Audit, Folgesitzung 2026-10-07,
// Dateigröße), über dieselbe Fläche wie api-keys.test.tsx. Nach dem Schnitt bleiben diese Tests unverändert.

const refresh = vi.fn();
const toast = vi.fn();
const fetchMock = vi.fn();

vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh }) }));
vi.mock("@/shared/ui/toast", () => ({ useToast: () => ({ toast }) }));

function jsonResponse(body: unknown, status = 200) {
  return { ok: status < 400, status, json: async () => body } as Response;
}

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((r) => {
    resolve = r;
  });
  return { promise, resolve };
}

const custom = { label: "Z.ai", baseUrl: "https://api.z.ai", model: "glm-4.6" };

beforeEach(() => {
  refresh.mockReset();
  toast.mockReset();
  fetchMock.mockReset().mockResolvedValue(jsonResponse({ ok: true }));
  vi.stubGlobal("fetch", fetchMock);
});

describe("ApiKeys: verbundener Anbieter, Aktivieren", () => {
  it("schickt PATCH mit dem Anbieter, meldet Erfolg und lädt die Seite neu", async () => {
    render(<ApiKeys configured={["anthropic", "openai"]} active="anthropic" customProvider={null} />);
    const user = userEvent.setup();

    await user.click(screen.getByRole("button", { name: "Aktivieren" }));

    await waitFor(() => expect(refresh).toHaveBeenCalledTimes(1));
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe("/api/settings/api-key");
    expect(init.method).toBe("PATCH");
    expect(init.headers).toEqual({ "content-type": "application/json" });
    expect(JSON.parse(init.body as string)).toEqual({ provider: "openai" });
    expect(toast).toHaveBeenCalledWith({ title: "OpenAI ist jetzt aktiv", variant: "success" });
  });

  it("zeigt bei einer Fehlerantwort den Text des Servers, lädt nicht neu und gibt den Knopf wieder frei", async () => {
    fetchMock.mockResolvedValue(jsonResponse({ detail: "Key ist abgelaufen." }, 400));
    render(<ApiKeys configured={["anthropic", "openai"]} active="anthropic" customProvider={null} />);
    const user = userEvent.setup();

    await user.click(screen.getByRole("button", { name: "Aktivieren" }));

    await waitFor(() => expect(toast).toHaveBeenCalledTimes(1));
    expect(toast).toHaveBeenCalledWith({
      title: "Konnte nicht aktiviert werden",
      description: "Key ist abgelaufen.",
      variant: "error",
    });
    expect(refresh).not.toHaveBeenCalled();
    await waitFor(() => expect(screen.getByRole("button", { name: "Aktivieren" })).toBeEnabled());
  });

  it("nimmt ohne Text vom Server den festen Text", async () => {
    fetchMock.mockResolvedValue(jsonResponse({}, 500));
    render(<ApiKeys configured={["anthropic", "openai"]} active="anthropic" customProvider={null} />);
    const user = userEvent.setup();

    await user.click(screen.getByRole("button", { name: "Aktivieren" }));

    await waitFor(() => expect(toast).toHaveBeenCalledTimes(1));
    expect(toast).toHaveBeenCalledWith({
      title: "Konnte nicht aktiviert werden",
      description: "Key konnte nicht aktiviert werden.",
      variant: "error",
    });
  });

  it("zeigt bei einem Netzfehler dessen Meldung, bei etwas anderem als einem Error 'Unbekannter Fehler'", async () => {
    fetchMock.mockRejectedValueOnce(new Error("offline"));
    render(<ApiKeys configured={["anthropic", "openai"]} active="anthropic" customProvider={null} />);
    const user = userEvent.setup();

    await user.click(screen.getByRole("button", { name: "Aktivieren" }));
    await waitFor(() => expect(toast).toHaveBeenCalledTimes(1));
    expect(toast.mock.calls[0][0]).toMatchObject({ description: "offline", variant: "error" });

    fetchMock.mockRejectedValueOnce("kaputt");
    await waitFor(() => expect(screen.getByRole("button", { name: "Aktivieren" })).toBeEnabled());
    await user.click(screen.getByRole("button", { name: "Aktivieren" }));
    await waitFor(() => expect(toast).toHaveBeenCalledTimes(2));
    expect(toast.mock.calls[1][0]).toMatchObject({
      description: "Unbekannter Fehler",
      variant: "error",
    });
  });

  it("sperrt die Zeile, solange die Anfrage läuft: Aktivieren und Entfernen gesperrt, nur eine Anfrage", async () => {
    const pending = deferred<Response>();
    fetchMock.mockReturnValue(pending.promise);
    render(<ApiKeys configured={["anthropic", "openai"]} active="anthropic" customProvider={null} />);
    const user = userEvent.setup();

    await user.click(screen.getByRole("button", { name: "Aktivieren" }));

    expect(screen.getByRole("button", { name: "Aktivieren" })).toBeDisabled();
    expect(screen.getByTestId("remove-openai")).toBeDisabled();
    await user.click(screen.getByTestId("remove-openai"));
    expect(fetchMock).toHaveBeenCalledTimes(1);

    pending.resolve(jsonResponse({ ok: true }));
    await waitFor(() => expect(refresh).toHaveBeenCalledTimes(1));
    await waitFor(() => expect(screen.getByRole("button", { name: "Aktivieren" })).toBeEnabled());
  });
});

describe("ApiKeys: verbundener Anbieter, Zustand der Zeile", () => {
  it("ein einziger verbundener Anbieter ohne aktiven Schlüssel steht auf 'Verbunden', ohne Aktivieren", () => {
    render(<ApiKeys configured={["anthropic"]} active={null} customProvider={null} />);
    expect(screen.getByText("Verbunden")).toBeInTheDocument();
    expect(screen.queryByText("Aktiv")).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Aktivieren" })).not.toBeInTheDocument();
  });

  it("der aktive Anbieter steht auf 'Aktiv', ohne Aktivieren", () => {
    render(<ApiKeys configured={["anthropic"]} active="anthropic" customProvider={null} />);
    expect(screen.getByText("Aktiv")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Aktivieren" })).not.toBeInTheDocument();
  });

  it("zählt den eigenen Endpunkt beim Umschalten mit: Anthropic daneben bietet Aktivieren an", () => {
    render(<ApiKeys configured={["anthropic", "custom"]} active="custom" customProvider={custom} />);
    expect(screen.getByRole("button", { name: "Aktivieren" })).toBeInTheDocument();
  });

  it("zeigt Name, Untertitel und einen beschrifteten Entfernen-Knopf je Anbieter", () => {
    render(<ApiKeys configured={["gemini"]} active="gemini" customProvider={null} />);
    expect(screen.getByText("Google")).toBeInTheDocument();
    expect(screen.getByText("Gemini")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Google-Key entfernen" })).toBeInTheDocument();
  });
});

describe("ApiKeys: verbundener Anbieter, Entfernen", () => {
  it("schickt DELETE mit dem Anbieter, meldet Erfolg und lädt die Seite neu", async () => {
    render(<ApiKeys configured={["anthropic"]} active="anthropic" customProvider={null} />);
    const user = userEvent.setup();

    await user.click(screen.getByRole("button", { name: "Anthropic-Key entfernen" }));

    await waitFor(() => expect(refresh).toHaveBeenCalledTimes(1));
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe("/api/settings/api-key?provider=anthropic");
    expect(init).toEqual({ method: "DELETE" });
    expect(toast).toHaveBeenCalledWith({ title: "Anthropic entfernt", variant: "success" });
  });

  it("zeigt bei einer Fehlerantwort den Text des Servers und lädt nicht neu", async () => {
    fetchMock.mockResolvedValue(jsonResponse({ detail: "Nicht gefunden." }, 404));
    render(<ApiKeys configured={["anthropic"]} active="anthropic" customProvider={null} />);
    const user = userEvent.setup();

    await user.click(screen.getByTestId("remove-anthropic"));

    await waitFor(() => expect(toast).toHaveBeenCalledTimes(1));
    expect(toast).toHaveBeenCalledWith({
      title: "Konnte nicht entfernt werden",
      description: "Nicht gefunden.",
      variant: "error",
    });
    expect(refresh).not.toHaveBeenCalled();
    await waitFor(() => expect(screen.getByTestId("remove-anthropic")).toBeEnabled());
  });

  it("nimmt ohne Text vom Server den festen Text", async () => {
    fetchMock.mockResolvedValue(jsonResponse({}, 500));
    render(<ApiKeys configured={["anthropic"]} active="anthropic" customProvider={null} />);
    const user = userEvent.setup();

    await user.click(screen.getByTestId("remove-anthropic"));

    await waitFor(() => expect(toast).toHaveBeenCalledTimes(1));
    expect(toast.mock.calls[0][0]).toMatchObject({
      description: "Key konnte nicht entfernt werden.",
      variant: "error",
    });
  });

  it("sperrt den Entfernen-Knopf, solange die Anfrage läuft", async () => {
    const pending = deferred<Response>();
    fetchMock.mockReturnValue(pending.promise);
    render(<ApiKeys configured={["anthropic"]} active="anthropic" customProvider={null} />);
    const user = userEvent.setup();

    await user.click(screen.getByTestId("remove-anthropic"));
    expect(screen.getByTestId("remove-anthropic")).toBeDisabled();
    await user.click(screen.getByTestId("remove-anthropic"));
    expect(fetchMock).toHaveBeenCalledTimes(1);

    pending.resolve(jsonResponse({ ok: true }));
    await waitFor(() => expect(refresh).toHaveBeenCalledTimes(1));
  });
});

describe("ApiKeys: eigener Endpunkt, verbundene Zeile", () => {
  it("zeigt Name, Modell, 'Verbunden' und einen beschrifteten Entfernen-Knopf", () => {
    render(<ApiKeys configured={["custom"]} active="custom" customProvider={custom} />);
    expect(screen.getByText("Z.ai")).toBeInTheDocument();
    expect(screen.getByText("glm-4.6")).toBeInTheDocument();
    expect(screen.getByText("Verbunden")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Custom-Key entfernen" })).toBeInTheDocument();
  });

  it("schickt DELETE für den eigenen Endpunkt, meldet 'Entfernt' und lädt die Seite neu", async () => {
    render(<ApiKeys configured={["custom"]} active="custom" customProvider={custom} />);
    const user = userEvent.setup();

    await user.click(screen.getByRole("button", { name: "Custom-Key entfernen" }));

    await waitFor(() => expect(refresh).toHaveBeenCalledTimes(1));
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe("/api/settings/api-key?provider=custom");
    expect(init).toEqual({ method: "DELETE" });
    expect(toast).toHaveBeenCalledWith({ title: "Entfernt", variant: "success" });
  });

  it("zeigt bei einer Fehlerantwort den Text des Servers, sonst den festen Text, und lädt nicht neu", async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse({ detail: "Gerade nicht möglich." }, 503));
    render(<ApiKeys configured={["custom"]} active="custom" customProvider={custom} />);
    const user = userEvent.setup();

    await user.click(screen.getByRole("button", { name: "Custom-Key entfernen" }));
    await waitFor(() => expect(toast).toHaveBeenCalledTimes(1));
    expect(toast.mock.calls[0][0]).toEqual({
      title: "Konnte nicht entfernt werden",
      description: "Gerade nicht möglich.",
      variant: "error",
    });

    fetchMock.mockResolvedValueOnce(jsonResponse({}, 500));
    await waitFor(() => expect(screen.getByRole("button", { name: "Custom-Key entfernen" })).toBeEnabled());
    await user.click(screen.getByRole("button", { name: "Custom-Key entfernen" }));
    await waitFor(() => expect(toast).toHaveBeenCalledTimes(2));
    expect(toast.mock.calls[1][0]).toMatchObject({ description: "Key konnte nicht entfernt werden." });
    expect(refresh).not.toHaveBeenCalled();
  });

  it("sperrt den Entfernen-Knopf, solange die Anfrage läuft", async () => {
    const pending = deferred<Response>();
    fetchMock.mockReturnValue(pending.promise);
    render(<ApiKeys configured={["custom"]} active="custom" customProvider={custom} />);
    const user = userEvent.setup();

    await user.click(screen.getByRole("button", { name: "Custom-Key entfernen" }));
    expect(screen.getByRole("button", { name: "Custom-Key entfernen" })).toBeDisabled();
    await user.click(screen.getByRole("button", { name: "Custom-Key entfernen" }));
    expect(fetchMock).toHaveBeenCalledTimes(1);

    pending.resolve(jsonResponse({ ok: true }));
    await waitFor(() => expect(refresh).toHaveBeenCalledTimes(1));
  });
});
