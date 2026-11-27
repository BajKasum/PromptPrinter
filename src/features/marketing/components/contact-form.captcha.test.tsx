import { beforeEach, describe, expect, it, vi } from "vitest";
import { act, fireEvent, render, screen } from "@testing-library/react";
import { ContactForm } from "./contact-form";

// Mit gesetztem Site-Key und dem echten Widget: nur Cloudflares `window.turnstile` ist nachgebildet. Ein Token ist
// einmal einlösbar, nach jedem Aufruf, nach dem das Formular wieder erscheint, braucht es ein neues.
vi.hoisted(() => {
  vi.stubEnv("NEXT_PUBLIC_TURNSTILE_SITE_KEY", "site-key");
});

const fetchMock = vi.fn();
const reset = vi.fn();
let rendered = 0;
let callback: (token: string) => void = () => {};

beforeEach(() => {
  fetchMock.mockReset();
  reset.mockReset();
  rendered = 0;
  vi.stubGlobal("fetch", fetchMock);
  window.turnstile = {
    render: (_container, params) => {
      callback = params.callback as (token: string) => void;
      return `widget-${++rendered}`;
    },
    reset,
    remove: vi.fn(),
  };
});

const deliver = (token: string) => act(() => callback(token));
const submit = () =>
  act(async () => {
    fireEvent.click(screen.getByRole("button", { name: /Nachricht senden/ }));
  });
const fill = () => {
  fireEvent.change(screen.getByLabelText("E-Mail"), { target: { value: "mira@example.com" } });
  fireEvent.change(screen.getByLabelText("Deine Nachricht"), { target: { value: "Eine lange genug Nachricht." } });
};
const sentTokens = () => fetchMock.mock.calls.map((call) => JSON.parse(call[1].body as string).turnstileToken);

describe("Kontaktformular: Turnstile-Token", () => {
  it.each([
    ["ohne Verbindung", () => Promise.reject(new TypeError("Failed to fetch"))],
    ["bei einer Absage", () => Promise.resolve(new Response("{}", { status: 503 }))],
  ])("wird %s verworfen, bis das Widget ein neues liefert", async (_label, answer) => {
    fetchMock.mockImplementation(answer);
    render(<ContactForm />);
    fill();
    deliver("token-1");
    await submit();
    expect(sentTokens()).toEqual(["token-1"]);
    expect(reset).toHaveBeenCalledWith("widget-1");

    await submit();
    expect(screen.getByRole("alert")).toHaveTextContent("ein Mensch bist");
    expect(fetchMock).toHaveBeenCalledTimes(1);

    deliver("token-2");
    await submit();
    expect(sentTokens()).toEqual(["token-1", "token-2"]);
  });

  it("gilt nach dem Senden nicht für die nächste Nachricht", async () => {
    fetchMock.mockResolvedValue(new Response("{}", { status: 200 }));
    render(<ContactForm />);
    fill();
    deliver("token-1");
    await submit();
    fireEvent.click(screen.getByRole("button", { name: "Noch eine Nachricht schreiben" }));
    expect(rendered).toBe(2);

    fill();
    await submit();
    expect(screen.getByRole("alert")).toHaveTextContent("ein Mensch bist");
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});
