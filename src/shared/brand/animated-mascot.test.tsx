import { readFileSync } from "node:fs";
import { join } from "node:path";
import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { AnimatedMascot, IDLE_CLASS } from "./animated-mascot";
import { MASCOT_STATES, type MascotMotion } from "./mascot-states";

// Finns Leerlauf ist CSS (app/globals.css), damit er auf dem Handy keinen Hauptthread kostet. Die Werte sind die
// Presets aus DESIGN.md und MASCOT.md: Ruhe bei 0 %, Ausschlag bei 50 %, ease-in-out, endlos. Ändert jemand eine
// Bewegung, ändert er sie hier bewusst mit.
const EXPECTED: Record<Exclude<MascotMotion, "none">, { seconds: string; rest: string; peak: string }> = {
  float: { seconds: "4s", rest: "translateY(0)", peak: "translateY(-8px)" },
  lean: { seconds: "5s", rest: "translateY(0) rotate(-2.5deg)", peak: "translateY(-3px) rotate(2.5deg)" },
  nod: { seconds: "1.8s", rest: "rotate(-3deg)", peak: "rotate(3deg)" },
  think: { seconds: "3.2s", rest: "translateY(0) rotate(-1.5deg)", peak: "translateY(-4px) rotate(1.5deg)" },
  bob: { seconds: "2.6s", rest: "translateY(0) rotate(-4deg)", peak: "translateY(-6px) rotate(4deg)" },
  cheer: {
    seconds: "1.4s",
    rest: "translateY(0) scale(1) rotate(-4deg)",
    peak: "translateY(-10px) scale(1.04) rotate(4deg)",
  },
  peek: { seconds: "3.4s", rest: "translateX(0) rotate(-2deg)", peak: "translateX(4px) rotate(2deg)" },
  sigh: { seconds: "4.4s", rest: "translateY(0)", peak: "translateY(3px)" },
};

const css = readFileSync(join(process.cwd(), "src", "app", "globals.css"), "utf8");
const squash = (s: string) => s.replace(/\s+/g, " ");
const flat = squash(css);

function keyframes(name: string): string {
  const start = flat.indexOf(`@keyframes ${name} {`);
  expect(start, `@keyframes ${name} fehlt in globals.css`).toBeGreaterThan(-1);
  const end = flat.indexOf("} }", start);
  return flat.slice(start, end + 3);
}

function reducedMotionBlocks(): string {
  return [...flat.matchAll(/@media \(prefers-reduced-motion: reduce\) \{(.*?)\} \}/g)].map((m) => m[1]).join(" ");
}

describe("Finns Leerlauf in CSS", () => {
  it("hat für jedes Preset eine Klasse, und jedes Preset eines Zustands hat eine", () => {
    expect(Object.keys(IDLE_CLASS).sort()).toEqual(Object.keys(EXPECTED).sort());
    for (const def of Object.values(MASCOT_STATES)) {
      if (def.motion !== "none") expect(IDLE_CLASS[def.motion]).toBeDefined();
    }
  });

  it.each(Object.entries(EXPECTED))("%s: Dauer, Easing und Ausschlag stimmen", (preset, want) => {
    const cls = IDLE_CLASS[preset as keyof typeof IDLE_CLASS];
    expect(flat).toContain(`.${cls} { animation: ${cls} ${want.seconds} ease-in-out infinite; }`);
    const frames = keyframes(cls);
    expect(frames).toContain(`0%, 100% { transform: ${want.rest}; }`);
    expect(frames).toContain(`50% { transform: ${want.peak}; }`);
  });

  it("steht unter prefers-reduced-motion still", () => {
    const reduced = reducedMotionBlocks();
    for (const cls of Object.values(IDLE_CLASS)) expect(reduced).toContain(`.${cls}`);
    expect(reduced).toMatch(/\.finn-idle-sigh \{ animation: none; \}/);
  });

  it("setzt die Klasse des Presets neben die Klassen des Aufrufers", () => {
    const { container } = render(<AnimatedMascot state="welcoming" className="mx-auto" />);
    const wrapper = container.firstElementChild!;
    expect(wrapper.className).toContain(IDLE_CLASS[MASCOT_STATES.welcoming.motion as keyof typeof IDLE_CLASS]);
    expect(wrapper.className).toContain("mx-auto");
    expect(wrapper.querySelector("img")).not.toBeNull();
  });

  it("übersteuert das Preset mit `motion` und lässt bei `none` jede Bewegung weg", () => {
    const { container: bob } = render(<AnimatedMascot state="welcoming" motion="bob" />);
    expect(bob.firstElementChild!.className).toContain("finn-idle-bob");
    expect(bob.firstElementChild!.className).not.toContain("finn-idle-float");

    const { container: still } = render(<AnimatedMascot state="welcoming" motion="none" />);
    expect(still.firstElementChild!.className).not.toMatch(/finn-idle-/);
  });

  it("bewegt den Rahmen ohne framer-motion (kein style.transform von JavaScript)", () => {
    const { container } = render(<AnimatedMascot state="celebrating" />);
    expect((container.firstElementChild as HTMLElement).style.transform).toBe("");
  });
});
