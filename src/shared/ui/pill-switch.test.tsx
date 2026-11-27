import { fireEvent, render, screen } from "@testing-library/react";
import { MessageSquare } from "lucide-react";
import { describe, expect, it, vi } from "vitest";
import { PillButton, PillLink, PillSwitch } from "./pill-switch";

describe("PillSwitch", () => {
  it("legt den Abstand nach aussen neben das eigene Aussehen", () => {
    const { container } = render(<PillSwitch className="mb-4">x</PillSwitch>);
    const bar = container.firstElementChild;
    expect(bar).toHaveClass("mb-4", "rounded-lg", "border", "bg-surface", "p-1");
  });

  it("PillLink ist ein Link; nur die aktive Pille trägt aria-current", () => {
    render(
      <PillSwitch>
        <PillLink href="/a" active Icon={MessageSquare} label="Erste" />
        <PillLink href="/b" active={false} Icon={MessageSquare} label="Zweite" />
      </PillSwitch>
    );
    const [first, second] = screen.getAllByRole("link");
    expect(first).toHaveAttribute("href", "/a");
    expect(first).toHaveAttribute("aria-current", "page");
    expect(first).not.toHaveAttribute("aria-pressed");
    expect(second).not.toHaveAttribute("aria-current");
  });

  it("PillButton sagt mit aria-pressed, ob er gewählt ist, und meldet den Klick", () => {
    const onClick = vi.fn();
    render(
      <PillSwitch>
        <PillButton active onClick={() => {}} Icon={MessageSquare} label="Erste" />
        <PillButton active={false} onClick={onClick} Icon={MessageSquare} label="Zweite" />
      </PillSwitch>
    );
    const [first, second] = screen.getAllByRole("button");
    expect(first).toHaveAttribute("aria-pressed", "true");
    expect(second).toHaveAttribute("aria-pressed", "false");
    expect(first).toHaveAttribute("type", "button");
    expect(first).not.toHaveAttribute("aria-current");
    fireEvent.click(second);
    expect(onClick).toHaveBeenCalledTimes(1);
  });

  it("Link und Knopf sehen gleich aus, aktiv angehoben und inaktiv gedämpft", () => {
    render(
      <>
        <PillLink href="/a" active Icon={MessageSquare} label="a1" />
        <PillButton active onClick={() => {}} Icon={MessageSquare} label="b1" />
        <PillLink href="/a" active={false} Icon={MessageSquare} label="a2" />
        <PillButton active={false} onClick={() => {}} Icon={MessageSquare} label="b2" />
      </>
    );
    const classesOf = (name: string) => screen.getByText(name).closest("a, button")!.className;
    expect(classesOf("a1")).toBe(classesOf("b1"));
    expect(classesOf("a2")).toBe(classesOf("b2"));
    expect(classesOf("a1")).toContain("bg-surface-raised");
    expect(classesOf("a2")).toContain("text-secondary");
  });
});
