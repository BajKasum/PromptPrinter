import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import { RepoStaleHint } from "./repo-stale-hint";

const fetchMock = vi.fn();
let n = 0;
const nextAnalysis = () => `2026-11-01T10:00:${String(n++).padStart(2, "0")}.000Z`;

const answer = (body: unknown, ok = true) => ({ ok, json: async () => body });

beforeEach(() => {
  fetchMock.mockReset();
  vi.stubGlobal("fetch", fetchMock);
});
afterEach(() => vi.unstubAllGlobals());

describe("RepoStaleHint", () => {
  it("zeigt den Hinweis, wenn die Route 'veraltet' meldet", async () => {
    fetchMock.mockResolvedValue(answer({ stale: true }));
    render(<RepoStaleHint projectId="p1" analyzedAt={nextAnalysis()} />);
    expect(await screen.findByText("Das Repo hat sich seit der Analyse vielleicht geändert.")).toBeInTheDocument();
    expect(fetchMock.mock.calls[0][0]).toBe("/api/projects/p1/brain/status");
    expect(fetchMock.mock.calls[0][1]).toMatchObject({ cache: "no-store" });
  });

  it.each([
    ["unverändert", answer({ stale: false })],
    ["unbekannt", answer({ stale: null })],
    ["Fehlerantwort", answer({ stale: true }, false)],
    ["Antwort ohne Feld", answer({})],
  ])("zeigt bei '%s' nichts", async (_name, response) => {
    fetchMock.mockResolvedValue(response);
    render(<RepoStaleHint projectId="p1" analyzedAt={nextAnalysis()} />);
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
    await new Promise((r) => setTimeout(r, 10));
    expect(screen.queryByText(/Repo hat sich/)).not.toBeInTheDocument();
  });

  it("bleibt bei einem Netzfehler still", async () => {
    fetchMock.mockRejectedValue(new TypeError("offline"));
    render(<RepoStaleHint projectId="p1" analyzedAt={nextAnalysis()} />);
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
    await new Promise((r) => setTimeout(r, 10));
    expect(screen.queryByText(/Repo hat sich/)).not.toBeInTheDocument();
  });

  it("fragt für dieselbe Analyse in dieser Sitzung nur einmal", async () => {
    fetchMock.mockResolvedValue(answer({ stale: true }));
    const at = nextAnalysis();
    const first = render(<RepoStaleHint projectId="p2" analyzedAt={at} />);
    await screen.findByText(/Repo hat sich/);
    first.unmount();
    render(<RepoStaleHint projectId="p2" analyzedAt={at} />);
    expect(screen.getByText(/Repo hat sich/)).toBeInTheDocument();
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("fragt nach einer neuen Analyse wieder", async () => {
    fetchMock.mockResolvedValueOnce(answer({ stale: true })).mockResolvedValueOnce(answer({ stale: false }));
    const view = render(<RepoStaleHint projectId="p3" analyzedAt={nextAnalysis()} />);
    await screen.findByText(/Repo hat sich/);
    view.rerender(<RepoStaleHint projectId="p3" analyzedAt={nextAnalysis()} />);
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(2));
    await waitFor(() => expect(screen.queryByText(/Repo hat sich/)).not.toBeInTheDocument());
  });
});
