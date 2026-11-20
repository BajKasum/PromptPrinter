import { describe, expect, it, vi } from "vitest";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { exportCode, exportJson, exportPromptFile } from "@/shared/lib/prompt-export";
import { PromptExportPanel } from "./prompt-export-panel";

const downloadFile = vi.fn();
vi.mock("@/shared/lib/utils", async (original) => ({
  ...(await original<typeof import("@/shared/lib/utils")>()),
  downloadFile: (...a: unknown[]) => downloadFile(...a),
}));

const PROMPT = "Du schreibst Briefe.\n\nSchreib an [Name des Vermieters].";
const preview = () => screen.getByLabelText("Vorschau des Exports").textContent;
const pick = (group: string, name: string) =>
  within(screen.getByRole("group", { name: group })).getByRole("button", { name });

describe("PromptExportPanel", () => {
  it("zeigt zuerst JSON für OpenAI-kompatible Server, mit leeren Platzhaltern als Variable", () => {
    render(<PromptExportPanel id="x" prompt={PROMPT} title="Brief" />);
    expect(preview()).toBe(exportJson("openai", { prompt: PROMPT, title: "Brief" }));
    expect(preview()).toContain("{{name_des_vermieters}}");
    expect(screen.getByText("Leere Platzhalter stehen als Variable wie {{name_des_vermieters}} im Export.")).toBeInTheDocument();
    expect(pick("Format", "JSON")).toHaveAttribute("aria-pressed", "true");
  });

  it("wechselt Schnittstelle und Format und nennt dazu den Key als Umgebungsvariable", async () => {
    const user = userEvent.setup();
    render(<PromptExportPanel id="x" prompt={PROMPT} title="Brief" />);
    await user.click(pick("Schnittstelle", "Anthropic"));
    await user.click(pick("Format", "curl"));
    expect(preview()).toBe(exportCode("anthropic", "curl", { prompt: PROMPT, title: "Brief" }));
    expect(screen.getByText("Der Key steht nie im Code, nur als Umgebungsvariable ANTHROPIC_API_KEY.")).toBeInTheDocument();

    await user.click(pick("Schnittstelle", "Gemini"));
    await user.click(pick("Format", "Python"));
    expect(preview()).toBe(exportCode("gemini", "python", { prompt: PROMPT, title: "Brief" }));
    expect(screen.getByText("Python 3, nur Standardbibliothek.")).toBeInTheDocument();
  });

  it("trennt auf Wunsch den ersten Absatz als Systemnachricht ab", async () => {
    const user = userEvent.setup();
    render(<PromptExportPanel id="x" prompt={PROMPT} title="Brief" />);
    await user.click(screen.getByLabelText("Ersten Absatz als Systemnachricht"));
    expect(JSON.parse(preview()!).messages[0]).toEqual({ role: "system", content: "Du schreibst Briefe." });
  });

  it("bietet das Abtrennen bei nur einem Absatz nicht an", () => {
    render(<PromptExportPanel id="x" prompt="Schreib ein Gedicht." title="G" />);
    expect(screen.getByLabelText("Ersten Absatz als Systemnachricht")).toBeDisabled();
    expect(screen.getByText("Der Prompt hat nur einen Absatz, es gibt nichts abzutrennen.")).toBeInTheDocument();
  });

  it("nimmt ausgefüllte Werte direkt in den Text", () => {
    const fill = { values: { "name des vermieters": "Frau Muster" }, skipped: new Set<string>() };
    render(<PromptExportPanel id="x" prompt={PROMPT} title="Brief" fill={fill} />);
    expect(JSON.parse(preview()!).messages[0].content).toBe("Du schreibst Briefe.\n\nSchreib an Frau Muster.");
    expect(screen.queryByText(/Leere Platzhalter/)).not.toBeInTheDocument();
  });

  it("lädt die Datei .prompt.md herunter, ohne Wahl der Schnittstelle", async () => {
    const user = userEvent.setup();
    render(<PromptExportPanel id="x" prompt={PROMPT} title="Brief an Vermieter" />);
    await user.click(pick("Format", ".prompt.md"));
    expect(screen.queryByRole("group", { name: "Schnittstelle" })).not.toBeInTheDocument();
    const file = exportPromptFile({ prompt: PROMPT, title: "Brief an Vermieter" });
    expect(preview()).toBe(file);
    await user.click(screen.getByRole("button", { name: "Herunterladen" }));
    expect(downloadFile).toHaveBeenCalledWith("brief-an-vermieter.prompt.md", file, "text/markdown");
  });

  it("kopiert genau, was die Vorschau zeigt", async () => {
    const user = userEvent.setup();
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, "clipboard", { value: { writeText }, configurable: true });
    render(<PromptExportPanel id="x" prompt={PROMPT} title="Brief" />);
    await user.click(pick("Format", "JavaScript"));
    await user.click(screen.getByRole("button", { name: "Kopieren" }));
    expect(writeText).toHaveBeenCalledWith(exportCode("openai", "javascript", { prompt: PROMPT, title: "Brief" }));
  });
});
