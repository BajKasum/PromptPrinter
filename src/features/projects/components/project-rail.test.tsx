import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ProjectRail } from "./project-rail";

const refresh = vi.fn();
const toast = vi.fn();
const update = vi.fn();

vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh }),
}));

vi.mock("@/shared/ui/toast", () => ({
  useToast: () => ({ toast }),
}));

vi.mock("@/shared/supabase/client", () => ({
  createClient: () => ({
    from: () => ({ update }),
  }),
}));

function setup(overrides: Partial<React.ComponentProps<typeof ProjectRail>> = {}) {
  render(
    <ProjectRail
      projectId="proj-1"
      initialInstructions="Ausgangslage"
      initialContext={{ target: "Claude" }}
      files={[]}
      resultCount={0}
      latestResultAt={null}
      {...overrides}
    />
  );
}

describe("ProjectRail", () => {
  beforeEach(() => {
    refresh.mockReset();
    toast.mockReset();
    update.mockReset();
    update.mockReturnValue({ eq: vi.fn().mockResolvedValue({ error: null }) });
  });

  it("does not persist on blur when nothing changed", async () => {
    const user = userEvent.setup();
    setup();
    const textarea = screen.getByLabelText("Projekt-Anweisungen");
    await user.click(textarea);
    await user.tab();
    expect(update).not.toHaveBeenCalled();
  });

  it("persists only instructions on blur when changed, Struktur is untouched", async () => {
    const eq = vi.fn().mockResolvedValue({ error: null });
    update.mockReturnValue({ eq });
    const user = userEvent.setup();
    setup();

    const textarea = screen.getByLabelText("Projekt-Anweisungen");
    await user.click(textarea);
    await user.type(textarea, "  mehr Kontext  ");
    await user.tab();

    // Exact match, not objectContaining: proves the write no longer carries
    // along the unrelated context column the way the old shared persist() did.
    expect(update).toHaveBeenCalledWith({ instructions: "Ausgangslage  mehr Kontext" });
    expect(eq).toHaveBeenCalledWith("id", "proj-1");
    expect(await screen.findByText("Gespeichert")).toBeInTheDocument();
    expect(refresh).toHaveBeenCalled();
  });

  it("persists only Struktur on blur, dropping blank fields, Anweisungen is untouched", async () => {
    const eq = vi.fn().mockResolvedValue({ error: null });
    update.mockReturnValue({ eq });
    const user = userEvent.setup();
    setup({ initialContext: {} });

    const frontendInput = screen.getByLabelText("Frontend");
    await user.click(frontendInput);
    await user.type(frontendInput, "Next.js");
    await user.tab();

    // Exact match: proves the write no longer carries along the Anweisungen
    // text the way the old shared persist() did.
    expect(update).toHaveBeenCalledWith({ context: { frontend: "Next.js" } });
  });

  it("shows the Struktur hint only while every field is still empty", async () => {
    const user = userEvent.setup();
    setup({ initialContext: {} });
    expect(screen.getByText(/Alles optional/)).toBeInTheDocument();

    await user.click(screen.getByLabelText("Frontend"));
    await user.type(screen.getByLabelText("Frontend"), "Next.js");
    expect(screen.queryByText(/Alles optional/)).not.toBeInTheDocument();
  });

  it("hides the Struktur hint when a field already carries content", () => {
    setup({ initialContext: { target: "Claude" } });
    expect(screen.queryByText(/Alles optional/)).not.toBeInTheDocument();
  });

  it("shows the Struktur save indicator independently of Anweisungen's", async () => {
    update.mockReturnValue({ eq: vi.fn().mockResolvedValue({ error: null }) });
    const user = userEvent.setup();
    setup({ initialContext: {} });

    const frontendInput = screen.getByLabelText("Frontend");
    await user.click(frontendInput);
    await user.type(frontendInput, "Next.js");
    await user.tab();

    // Only one indicator lights up (Struktur's), Anweisungen's stays idle
    // (SaveIndicator renders null for "idle"), so exactly one "status" node
    // exists at this point.
    const indicators = await screen.findAllByRole("status");
    expect(indicators).toHaveLength(1);
    expect(indicators[0]).toHaveTextContent("Gespeichert");
  });

  it("shows an error toast and indicator when persisting fails", async () => {
    update.mockReturnValue({ eq: vi.fn().mockResolvedValue({ error: { message: "fail" } }) });
    const user = userEvent.setup();
    setup();

    const textarea = screen.getByLabelText("Projekt-Anweisungen");
    await user.click(textarea);
    await user.type(textarea, "geändert");
    await user.tab();

    expect(await screen.findByText("Fehler")).toBeInTheDocument();
    expect(toast).toHaveBeenCalledWith(expect.objectContaining({ variant: "error" }));
    expect(refresh).not.toHaveBeenCalled();
  });

  it("shows the empty-results copy when no results exist yet", () => {
    setup({ resultCount: 0 });
    expect(screen.getByText("Noch keine gespeichert")).toBeInTheDocument();
  });

  it("shows the saved-prompt count and last-result timestamp when results exist", () => {
    setup({ resultCount: 3, latestResultAt: "vor 2 Tagen" });
    expect(screen.getByText("3 Prompts · zuletzt vor 2 Tagen")).toBeInTheDocument();
  });

  it("singularizes a single saved prompt", () => {
    setup({ resultCount: 1, latestResultAt: null });
    expect(screen.getByText("1 Prompt")).toBeInTheDocument();
  });
});
