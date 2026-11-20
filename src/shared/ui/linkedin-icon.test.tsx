import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { LinkedinIcon } from "./linkedin-icon";

describe("LinkedinIcon", () => {
  it("ist reine Verzierung in der Textfarbe, mit Grösse und Strich wie ein Lucide-Symbol", () => {
    const { container } = render(<LinkedinIcon className="h-4 w-4" strokeWidth={1.8} />);
    const svg = container.querySelector("svg");
    expect(svg).toHaveAttribute("aria-hidden", "true");
    expect(svg).toHaveAttribute("stroke", "currentColor");
    expect(svg).toHaveAttribute("stroke-width", "1.8");
    expect(svg).toHaveClass("h-4", "w-4");
    expect(svg?.querySelectorAll("path, rect, circle")).toHaveLength(3);
  });
});
