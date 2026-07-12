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

vi.mock("@/components/ui/toast", () => ({
  useToast: () => ({ toast }),
}));

vi.mock("@/lib/supabase/client", () => ({
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

  it("persists trimmed instructions on blur when changed", async () => {
    const eq = vi.fn().mockResolvedValue({ error: null });
    update.mockReturnValue({ eq });
    const user = userEvent.setup();
    setup();

    const textarea = screen.getByLabelText("Projekt-Anweisungen");
    await user.click(textarea);
    await user.type(textarea, "  mehr Kontext  ");
    await user.tab();

    expect(update).toHaveBeenCalledWith(
      expect.objectContaining({
        instructions: expect.stringContaining("mehr Kontext"),
      })
    );
    expect(eq).toHaveBeenCalledWith("id", "proj-1");
    expect(await screen.findByText("Gespeichert")).toBeInTheDocument();
    expect(refresh).toHaveBeenCalled();
  });

  it("persists a Struktur field on blur, dropping blank fields from context", async () => {
    const eq = vi.fn().mockResolvedValue({ error: null });
    update.mockReturnValue({ eq });
    const user = userEvent.setup();
    setup({ initialContext: {} });

    const frontendInput = screen.getByLabelText("Frontend");
    await user.click(frontendInput);
    await user.type(frontendInput, "Next.js");
    await user.tab();

    expect(update).toHaveBeenCalledWith(
      expect.objectContaining({ context: { frontend: "Next.js" } })
    );
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

  it("shows the run count and last-result timestamp when results exist", () => {
    setup({ resultCount: 3, latestResultAt: "vor 2 Tagen" });
    expect(screen.getByText("3 Läufe · zuletzt vor 2 Tagen")).toBeInTheDocument();
  });

  it("singularizes a single run", () => {
    setup({ resultCount: 1, latestResultAt: null });
    expect(screen.getByText("1 Lauf")).toBeInTheDocument();
  });
});
