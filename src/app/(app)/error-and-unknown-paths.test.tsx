import type { ReactElement, ReactNode } from "react";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { fmt } from "@/shared/i18n/format";
import { de } from "@/shared/i18n/messages/de";
import AppError from "./error";
import AppNotFound from "./not-found";
import ChatsRest from "./chats/[id]/[...rest]/page";
import CliRest from "./cli/[...rest]/page";
import CliLoginPage from "./cli/page";
import ProjectsRest from "./projects/[id]/[...rest]/page";
import PromptsRest from "./prompts/[...rest]/page";
import SettingsRest from "./settings/[...rest]/page";
import UsageRest from "./usage/[...rest]/page";

// Die Ränder der App: unbekannte Adressen, die 404 darunter, die Fehlerseite und die Bestätigung der Terminal-Anmeldung.
const captureError = vi.fn();
const approval = vi.fn();

vi.mock("next/navigation", () => ({
  notFound: () => {
    throw new Error("NEXT_NOT_FOUND");
  },
}));
vi.mock("next/link", () => ({
  default: ({ href, children }: { href: string; children: ReactNode }) => <a href={href}>{children}</a>,
}));
vi.mock("@/shared/lib/observability", () => ({ captureError: (...args: unknown[]) => captureError(...args) }));
vi.mock("@/server/i18n", async () => {
  const { de } = await import("@/shared/i18n/messages/de");
  return { getT: async () => de };
});
vi.mock("@/shared/motion/fade-in", () => ({ FadeIn: ({ children }: { children: ReactNode }) => <div>{children}</div> }));
vi.mock("@/features/auth/components/cli-approval", () => ({
  CliApproval: (props: Record<string, unknown>) => {
    approval(props);
    return <form aria-label="Code bestätigen" />;
  },
}));

beforeEach(() => {
  captureError.mockClear();
  approval.mockClear();
});

// Ohne diese Auffangrouten ginge eine unbekannte Adresse an die statische 404, die unter der Nonce-Policy der App nicht
// hydriert.
describe("unbekannte Adressen unter den Bereichen der App", () => {
  it.each([
    ["/chats/<id>/…", ChatsRest],
    ["/cli/…", CliRest],
    ["/projects/<id>/…", ProjectsRest],
    ["/prompts/…", PromptsRest],
    ["/settings/…", SettingsRest],
    ["/usage/…", UsageRest],
  ])("%s ergibt die 404 der App", (_name, page) => {
    expect(page).toThrow("NEXT_NOT_FOUND");
  });

  it("die 404 der App führt zu Chats und Projekten", async () => {
    render(await AppNotFound());
    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent(de.pages.notFound.title);
    expect(screen.getByRole("link", { name: de.pages.notFound.toChats })).toHaveAttribute("href", "/chats");
    expect(screen.getByRole("link", { name: de.pages.notFound.projects })).toHaveAttribute("href", "/projects");
  });
});

describe("AppError", () => {
  const error = Object.assign(new Error("Datenbank weg"), { digest: "abc123" });

  it("meldet den Fehler mit seiner Kennung und zeigt nur die Kennung, nicht die Meldung", () => {
    render(<AppError error={error} reset={() => {}} />);

    expect(captureError).toHaveBeenCalledWith("app.render_error", error, { digest: "abc123" });
    expect(screen.getByText(fmt(de.pages.error.errorId, { id: "abc123" }))).toBeInTheDocument();
    expect(document.body).not.toHaveTextContent("Datenbank weg");
    expect(screen.getByRole("link", { name: de.pages.error.toChats })).toHaveAttribute("href", "/chats");
  });

  it("versucht es auf Wunsch noch einmal", async () => {
    const reset = vi.fn();
    render(<AppError error={error} reset={reset} />);

    await userEvent.setup().click(screen.getByRole("button", { name: de.common.retry }));

    expect(reset).toHaveBeenCalledTimes(1);
  });

  it("zeigt ohne Kennung keine Zeile dafür", () => {
    render(<AppError error={new Error("x")} reset={() => {}} />);
    expect(screen.queryByText(new RegExp(fmt(de.pages.error.errorId, { id: "" }).trim()))).not.toBeInTheDocument();
  });
});

// Ein vorausgefüllter Link liesse sich jemandem unterschieben: der Code aus dem Terminal wird immer abgetippt.
describe("CliLoginPage", () => {
  it("gibt nichts aus der Adresse an die Bestätigung weiter", async () => {
    const page = CliLoginPage as unknown as (props: unknown) => Promise<ReactElement>;

    render(await page({ searchParams: Promise.resolve({ code: "ABCD-EFGH", user_code: "ABCD-EFGH" }) }));

    expect(screen.getByRole("form", { name: "Code bestätigen" })).toBeInTheDocument();
    expect(approval.mock.lastCall?.[0]).toEqual({});
    expect(document.body.innerHTML).not.toContain("ABCD-EFGH");
  });
});
