import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";

vi.mock("next/headers", () => ({ headers: async () => new Headers({ "x-forwarded-for": "203.0.113.7" }) }));
const notFound = vi.fn(() => {
  throw new Error("NEXT_NOT_FOUND");
});
vi.mock("next/navigation", () => ({ notFound: () => notFound() }));
const rateLimit = vi.fn();
vi.mock("@/server/security/rate-limit", () => ({
  rateLimit: (...a: unknown[]) => rateLimit(...a),
  rateLimitKey: (_r: unknown, scope: string) => `${scope}:ip:x`,
}));
const loadSharedPrompt = vi.fn();
vi.mock("@/server/prompt-share", () => ({ loadSharedPrompt: (...a: unknown[]) => loadSharedPrompt(...a) }));
vi.mock("@/shared/brand/animated-mascot", () => ({ AnimatedMascot: () => <span data-testid="finn" /> }));

import SharedPromptPage, { metadata } from "./page";

const params = (token: string) => ({ params: Promise.resolve({ token }) });

describe("/geteilt/[token]", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    rateLimit.mockResolvedValue({ allowed: true });
  });

  it("steht nie im Index und gibt keinen Referrer weiter", () => {
    expect(metadata.robots).toMatchObject({ index: false, follow: false });
    expect(metadata.referrer).toBe("no-referrer");
  });

  it("zeigt Titel, Prompt, Kopieren und die Einladung zu Finn", async () => {
    loadSharedPrompt.mockResolvedValue({ title: "Einladung", content: "Schreibe eine Einladung", sharedAt: "x" });
    render(await SharedPromptPage(params("t")));
    expect(screen.getByRole("heading", { level: 1, name: "Einladung" })).toBeInTheDocument();
    expect(screen.getByText("Schreibe eine Einladung")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Prompt kopieren" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Mach deinen eigenen Prompt mit Finn." })).toBeInTheDocument();
    expect(screen.getByTestId("finn")).toBeInTheDocument();
  });

  it("antwortet 404 auf ein unbekanntes oder widerrufenes Token", async () => {
    loadSharedPrompt.mockResolvedValue(null);
    await expect(SharedPromptPage(params("weg"))).rejects.toThrow("NEXT_NOT_FOUND");
  });

  it("bremst, wer zu viele Tokens durchprobiert, ohne die Datenbank zu fragen", async () => {
    rateLimit.mockResolvedValue({ allowed: false });
    render(await SharedPromptPage(params("t")));
    expect(screen.getByRole("heading", { level: 1 })).toBeInTheDocument();
    expect(loadSharedPrompt).not.toHaveBeenCalled();
  });
});
