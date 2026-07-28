import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { UsageMeter } from "./usage-meter";

describe("UsageMeter", () => {
  it("shows used against the limit for a capped account", () => {
    render(<UsageMeter label="Chat-Nachrichten" used={42} limit={200} />);
    expect(screen.getByText("42")).toBeInTheDocument();
    expect(screen.getByText("/ 200")).toBeInTheDocument();
  });

  it("marks an unlimited account without a numeric cap", () => {
    render(<UsageMeter label="Chat-Nachrichten" used={5} limit={Infinity} />);
    expect(screen.getByText((_, el) => el?.textContent === "· Unbegrenzt")).toBeInTheDocument();
  });

  // QA finding E-3: an admin account has no monthly cap, so `used` can grow to
  // whatever it grows to over the account's lifetime, unlike a capped
  // account where it never exceeds `limit`. A raw four/five-digit number here
  // used to have nothing bounding its width.
  it("shows a large unlimited count compactly rather than as a raw long number", () => {
    render(<UsageMeter label="Chat-Nachrichten" used={12345} limit={Infinity} />);
    const meter = screen.getByTitle("12345");
    expect(meter.textContent).not.toContain("12345");
    expect(meter.textContent).toContain("12.3 Tsd.");
  });

  it("compacts into millions once it grows past a thousand-fold", () => {
    render(<UsageMeter label="Chat-Nachrichten" used={2_400_000} limit={Infinity} />);
    expect(screen.getByTitle("2400000").textContent).toContain("2.4 Mio.");
  });

  it("leaves a sub-thousand count as a plain number", () => {
    render(<UsageMeter label="Chat-Nachrichten" used={42} limit={Infinity} />);
    expect(screen.getByTitle("42").textContent).toContain("42");
  });

  it("keeps the exact value reachable via the title attribute", () => {
    render(<UsageMeter label="Chat-Nachrichten" used={12345} limit={Infinity} />);
    expect(screen.getByTitle("12345")).toBeInTheDocument();
  });
});
