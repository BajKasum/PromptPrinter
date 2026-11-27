import { beforeEach, describe, expect, it, vi } from "vitest";
import { act, fireEvent, render, screen } from "@testing-library/react";
import { SignInExperience } from "./sign-in-experience";
import { SignUpExperience } from "./sign-up-experience";
import { RequestPasswordResetExperience } from "./request-password-reset-experience";

// Mit gesetztem Site-Key und dem echten Widget: nur Cloudflares `window.turnstile` ist nachgebildet. Ein Token ist
// einmal einlösbar, jeder Zweig, nach dem das Formular stehen bleibt, muss es also verwerfen und ein neues anfordern.
vi.hoisted(() => {
  vi.stubEnv("NEXT_PUBLIC_TURNSTILE_SITE_KEY", "site-key");
});

const postAuthAction = vi.fn();

vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }) }));
vi.mock("@/shared/lib/auth-client", () => ({
  postAuthAction: (...args: unknown[]) => postAuthAction(...args),
}));
vi.mock("@/features/auth/components/auth-experience-shell", () => ({
  AuthExperienceShell: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));
vi.mock("@/shared/brand/animated-mascot", () => ({ AnimatedMascot: () => null }));

const reset = vi.fn();
let rendered = 0;
let callback: (token: string) => void = () => {};

beforeEach(() => {
  window.history.replaceState(null, "", "/login");
  postAuthAction.mockReset();
  reset.mockReset();
  rendered = 0;
  window.turnstile = {
    render: (_container, params) => {
      callback = params.callback as (token: string) => void;
      return `widget-${++rendered}`;
    },
    reset,
    remove: vi.fn(),
  };
});

/** Das zuletzt gezeigte Widget meldet ein Token. */
const deliver = (token: string) => act(() => callback(token));
const type = (placeholder: string | RegExp, value: string) =>
  fireEvent.change(screen.getByPlaceholderText(placeholder), { target: { value } });
const submitForm = () =>
  act(async () => {
    fireEvent.submit(screen.getByPlaceholderText("du@example.com").closest("form")!);
  });
const click = (name: RegExp) =>
  act(async () => {
    fireEvent.click(screen.getByRole("button", { name }));
  });
const tokens = () => postAuthAction.mock.calls.map((call) => call[1]);

const REFUSED = { ok: false, message: "Das ging schief", captchaFailed: false };

/**
 * Nach einem Aufruf, der das Token verbraucht hat: das Widget stellt ein neues aus, bis dahin sendet das Formular
 * nichts, danach geht das neue Token mit.
 */
async function expectFreshTokenNeeded(widgetId: string, send: () => Promise<void>) {
  expect(reset).toHaveBeenCalledWith(widgetId);
  const calls = postAuthAction.mock.calls.length;

  await send();
  expect(screen.getByRole("alert")).toHaveTextContent("ein Mensch bist");
  expect(postAuthAction).toHaveBeenCalledTimes(calls);

  deliver("token-neu");
  await send();
  expect(tokens().at(-1)).toBe("token-neu");
}

describe("Turnstile-Token nach einem Fehlschlag", () => {
  it("Anmelden: eine Absage verwirft es", async () => {
    postAuthAction.mockResolvedValue(REFUSED);
    render(<SignInExperience />);
    type("du@example.com", "user@example.com");
    type("Passwort", "password123");
    deliver("token-1");
    await submitForm();
    expect(tokens()).toEqual(["token-1"]);
    expect(screen.getByRole("alert")).toHaveTextContent("Das ging schief");

    await expectFreshTokenNeeded("widget-1", submitForm);
  });

  it("Registrieren: eine Absage verwirft es", async () => {
    postAuthAction.mockResolvedValue(REFUSED);
    render(<SignUpExperience />);
    type("du@example.com", "user@example.com");
    type(/^Passwort/, "Fensterbank-77x");
    fireEvent.click(screen.getByRole("checkbox"));
    deliver("token-1");
    await submitForm();
    expect(tokens()).toEqual(["token-1"]);

    await expectFreshTokenNeeded("widget-1", submitForm);
  });

  async function reachSentState() {
    postAuthAction.mockResolvedValue({ ok: true, session: false });
    render(<SignUpExperience />);
    type("du@example.com", "user@example.com");
    type(/^Passwort/, "Fensterbank-77x");
    fireEvent.click(screen.getByRole("checkbox"));
    deliver("token-1");
    await submitForm();
    expect(screen.getByText("Email unterwegs")).toBeInTheDocument();
    // Das Widget des Formulars ist weg, das der Mail-Ansicht neu.
    expect(rendered).toBe(2);
  }

  it("Registrieren ohne Sitzung: das verbrauchte Token geht nicht in die Mail-Ansicht mit", async () => {
    await reachSentState();
    await click(/Email erneut senden/);
    expect(screen.getByRole("alert")).toHaveTextContent("ein Mensch bist");
    expect(postAuthAction).toHaveBeenCalledTimes(1);
  });

  it.each([
    ["gelungen", { ok: true, session: true }],
    ["abgewiesen", REFUSED],
  ])("Erneut senden (%s): das Token wird verworfen", async (_label, answer) => {
    await reachSentState();
    postAuthAction.mockResolvedValue(answer);
    deliver("token-2");
    reset.mockClear();
    await click(/Email erneut senden/);
    expect(tokens()).toEqual(["token-1", "token-2"]);

    await expectFreshTokenNeeded("widget-2", () => click(/Email erneut senden/));
  });

  it("Passwort zurücksetzen: eine Absage verwirft es", async () => {
    postAuthAction.mockResolvedValue(REFUSED);
    render(<RequestPasswordResetExperience />);
    type("du@example.com", "user@example.com");
    deliver("token-1");
    await submitForm();
    expect(tokens()).toEqual(["token-1"]);

    await expectFreshTokenNeeded("widget-1", submitForm);
  });
});
