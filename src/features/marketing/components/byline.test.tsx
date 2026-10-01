import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { LEGAL } from "@/shared/lib/legal";
import { Byline } from "./byline";

describe("Byline", () => {
  it("nennt den Autor und verlinkt auf die Über-Seite", () => {
    render(<Byline updated="2026-10-01" />);
    const author = screen.getByRole("link", { name: LEGAL.operator });

    expect(author).toHaveAttribute("href", "/ueber");
    expect(author).toHaveAttribute("rel", "author");
  });

  it("zeigt das Datum ausgeschrieben und maschinenlesbar", () => {
    render(<Byline updated="2026-10-01" />);
    const date = screen.getByText("1. Oktober 2026");

    expect(date.tagName).toBe("TIME");
    expect(date).toHaveAttribute("datetime", "2026-10-01");
  });
});
