import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ApiKeyField } from "./api-key-field";
import { de } from "@/shared/i18n/messages/de";

// Das Key-Feld in Einstellungen und Chat: bei einem Fehlschlag steht im Toast ein verständlicher Satz, nie die
// Meldung des Browsers (#408), und eine Antwort, die nicht von der Route stammt, zählt nicht als gespeichert.

const refresh = vi.fn();
const toast = vi.fn();
const onUnrecognized = vi.fn();
const onConnected = vi.fn();
const fetchMock = vi.fn();

vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh }) }));
vi.mock("@/shared/ui/toast", () => ({ useToast: () => ({ toast }) }));

function answer(body: string, status: number, type: string) {
  return new Response(body, { status, headers: { "content-type": type } });
}

async function submitKey() {
  const user = userEvent.setup();
  render(<ApiKeyField configured={[]} onUnrecognized={onUnrecognized} onConnected={onConnected} />);
  await user.type(screen.getByLabelText(de.settings.keys.label), "sk-ant-abcdef");
  await user.click(screen.getByRole("button", { name: de.settings.keys.add }));
}

beforeEach(() => {
  for (const mock of [refresh, toast, onUnrecognized, onConnected, fetchMock]) mock.mockReset();
  vi.stubGlobal("fetch", fetchMock);
});
afterEach(() => vi.unstubAllGlobals());

describe("ApiKeyField: Fehlschlag", () => {
  it("zeigt den Satz der Route und meldet einen unbekannten Anbieter weiter", async () => {
    fetchMock.mockResolvedValue(
      answer('{"detail":"Anbieter unbekannt.","kind":"unknownProvider"}', 400, "application/problem+json")
    );

    await submitKey();

    await waitFor(() => expect(toast).toHaveBeenCalled());
    expect(toast).toHaveBeenCalledWith({
      title: de.settings.saveFailed,
      description: "Anbieter unbekannt.",
      variant: "error",
    });
    expect(onUnrecognized).toHaveBeenCalledTimes(1);
    expect(onConnected).not.toHaveBeenCalled();
  });

  it("zeigt bei einem 504 mit HTML-Seite den eigenen Satz", async () => {
    fetchMock.mockResolvedValue(answer("<!DOCTYPE html><h1>504</h1>", 504, "text/html"));

    await submitKey();

    await waitFor(() => expect(toast).toHaveBeenCalled());
    expect(toast.mock.calls[0][0]).toMatchObject({ description: de.settings.keys.saveFailed });
    expect(onUnrecognized).not.toHaveBeenCalled();
  });

  it("zeigt ohne Netz den Netzwerk-Satz statt 'Failed to fetch'", async () => {
    fetchMock.mockRejectedValue(new TypeError("Failed to fetch"));

    await submitKey();

    await waitFor(() => expect(toast).toHaveBeenCalled());
    expect(toast.mock.calls[0][0]).toMatchObject({ description: de.common.networkError, variant: "error" });
  });

  it("meldet ein 200 mit HTML-Seite nicht als gespeichert", async () => {
    fetchMock.mockResolvedValue(answer("<!DOCTYPE html><h1>Bitte anmelden</h1>", 200, "text/html"));

    await submitKey();

    await waitFor(() => expect(toast).toHaveBeenCalled());
    expect(toast.mock.calls[0][0]).toMatchObject({ description: de.settings.keys.saveFailed, variant: "error" });
    expect(onConnected).not.toHaveBeenCalled();
    expect(refresh).not.toHaveBeenCalled();
    expect(screen.getByLabelText(de.settings.keys.label)).toHaveValue("sk-ant-abcdef");
  });
});
