import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { HoverPrefetchLink } from "./hover-prefetch-link";

// next/link ersetzt durch einen Anker, der den `prefetch`-Wert sichtbar macht: der Test prueft, was die
// Huelle an Next weitergibt, nicht Nexts eigenes Prefetchen.
vi.mock("next/link", () => ({
  default: ({
    prefetch,
    href,
    children,
    ...rest
  }: {
    prefetch?: boolean | "auto" | null;
    href: string;
    children?: React.ReactNode;
  } & Record<string, unknown>) => (
    <a href={href} data-prefetch={String(prefetch)} {...rest}>
      {children}
    </a>
  ),
}));

const link = () => screen.getByRole("link", { name: "Chat" });

describe("HoverPrefetchLink", () => {
  it("prefetcht nicht, solange niemand den Link ansteuert (#157)", () => {
    render(<HoverPrefetchLink href="/chats/1">Chat</HoverPrefetchLink>);
    expect(link()).toHaveAttribute("data-prefetch", "false");
  });

  it.each([
    ["Maus", (el: Element) => fireEvent.mouseEnter(el)],
    ["Tastatur", (el: Element) => fireEvent.focus(el)],
    ["Finger", (el: Element) => fireEvent.touchStart(el)],
  ])("schaltet bei %s auf das Standard-Prefetchen um", (_name, act) => {
    render(<HoverPrefetchLink href="/chats/1">Chat</HoverPrefetchLink>);
    act(link());
    expect(link()).toHaveAttribute("data-prefetch", "null");
  });

  it("reicht eigene Handler weiter und lässt Klasse, Titel und aria-current stehen", () => {
    const onMouseEnter = vi.fn();
    render(
      <HoverPrefetchLink href="/chats/1" onMouseEnter={onMouseEnter} className="row" title="Titel" aria-current="page">
        Chat
      </HoverPrefetchLink>
    );
    fireEvent.mouseEnter(link());
    expect(onMouseEnter).toHaveBeenCalledTimes(1);
    expect(link()).toHaveClass("row");
    expect(link()).toHaveAttribute("title", "Titel");
    expect(link()).toHaveAttribute("aria-current", "page");
  });

  it("schaltet nicht um, wenn nur ein anderer Link der Liste angesteuert wird", () => {
    render(
      <>
        <HoverPrefetchLink href="/chats/1">Chat</HoverPrefetchLink>
        <HoverPrefetchLink href="/chats/2">Anderer</HoverPrefetchLink>
      </>
    );
    fireEvent.mouseEnter(screen.getByRole("link", { name: "Anderer" }));
    expect(screen.getByRole("link", { name: "Anderer" })).toHaveAttribute("data-prefetch", "null");
    expect(link()).toHaveAttribute("data-prefetch", "false");
  });
});
