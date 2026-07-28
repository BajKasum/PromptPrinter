import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { CopyMoment } from "./copy-moment";

// QA finding A-3: the visual "Kopiert" swap carried no confirmation for a
// screen reader — nothing announced that the click had actually done
// anything. The label now lives in its own aria-live region in every branch.
describe("CopyMoment", () => {
  it("shows the idle label inside a live region", () => {
    render(<CopyMoment copied={false} copyCount={0} idleLabel="Prompt kopieren" />);
    const label = screen.getByText("Prompt kopieren");
    expect(label).toHaveAttribute("aria-live", "polite");
  });

  it("announces the copied state through the same live region", () => {
    render(<CopyMoment copied={true} copyCount={1} idleLabel="Prompt kopieren" />);
    const label = screen.getByText("Kopiert");
    expect(label).toHaveAttribute("aria-live", "polite");
  });

  it("uses a custom copied label when given, still inside the live region", () => {
    render(
      <CopyMoment
        copied={true}
        copyCount={1}
        idleLabel="Antwort kopieren"
        copiedLabel="Antwort kopiert"
      />
    );
    expect(screen.getByText("Antwort kopiert")).toHaveAttribute("aria-live", "polite");
  });
});
