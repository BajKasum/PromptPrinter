import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import * as lucide from "lucide-react";
import { GithubIcon } from "@/shared/ui/github-icon";

// Das Symbol muss genauso aussehen wie das `Github` aus lucide-react 0.474.0, das es ersetzt
// (lucide-react 1.0 hat die Marken-Symbole entfernt). Die Pfade stehen deshalb hier als Text,
// unabhängig davon, welche Lucide-Version gerade installiert ist.
const PATH_ONE =
  "M15 22v-4a4.8 4.8 0 0 0-1-3.5c3 0 6-2 6-5.5.08-1.25-.27-2.48-1-3.5.28-1.15.28-2.35 0-3.5 0 0-1 0-3 1.5-2.64-.5-5.36-.5-8 0C6 2 5 2 5 2c-.3 1.15-.3 2.35 0 3.5A5.403 5.403 0 0 0 4 9c0 3.5 3 5.5 6 5.5-.39.49-.68 1.05-.85 1.65-.17.6-.22 1.23-.15 1.85v4";
const PATH_TWO = "M9 18c-4.51 2-5-2-7-2";

function svgOf(container: HTMLElement): SVGSVGElement {
  const svg = container.querySelector("svg");
  if (!svg) throw new Error("kein <svg> gerendert");
  return svg;
}

describe("GithubIcon", () => {
  it("zeichnet genau die zwei Pfade des alten Lucide-Symbols", () => {
    const svg = svgOf(render(<GithubIcon />).container);
    expect(Array.from(svg.querySelectorAll("path")).map((p) => p.getAttribute("d"))).toEqual([PATH_ONE, PATH_TWO]);
  });

  it("hat die Lucide-Standardwerte: 24 x 24, Umriss in currentColor, Strichstärke 2, runde Enden", () => {
    const svg = svgOf(render(<GithubIcon />).container);
    expect(svg.getAttribute("width")).toBe("24");
    expect(svg.getAttribute("height")).toBe("24");
    expect(svg.getAttribute("viewBox")).toBe("0 0 24 24");
    expect(svg.getAttribute("fill")).toBe("none");
    expect(svg.getAttribute("stroke")).toBe("currentColor");
    expect(svg.getAttribute("stroke-width")).toBe("2");
    expect(svg.getAttribute("stroke-linecap")).toBe("round");
    expect(svg.getAttribute("stroke-linejoin")).toBe("round");
  });

  it("nimmt Größe über className und Strichstärke über strokeWidth, wie project-brain.tsx es braucht", () => {
    const svg = svgOf(render(<GithubIcon className="h-3.5 w-3.5" strokeWidth={1.8} />).container);
    expect(svg.getAttribute("class")).toBe("h-3.5 w-3.5");
    expect(svg.getAttribute("stroke-width")).toBe("1.8");
  });

  it("ist Verzierung für Screenreader (die Beschriftung daneben sagt, was es ist)", () => {
    expect(svgOf(render(<GithubIcon />).container).getAttribute("aria-hidden")).toBe("true");
  });

  // Solange lucide-react 0.x installiert ist, zeigt dieser Zwilling, dass die Zeichnung Zeichen
  // für Zeichen dieselbe ist. Mit 1.x gibt es das Symbol nicht mehr, der Test entfällt dann von selbst.
  const lucideGithub = (lucide as unknown as Record<string, React.ComponentType<React.SVGProps<SVGSVGElement>> | undefined>).Github;
  it.skipIf(!lucideGithub)("gleicht dem gerenderten Github-Symbol von lucide-react 0.x (ohne Klassen und aria-hidden)", () => {
    const Lucide = lucideGithub!;
    const strip = (html: string) => html.replace(/ class="[^"]*"/g, "").replace(/ aria-hidden="true"/g, "");
    const ours = strip(svgOf(render(<GithubIcon />).container).outerHTML);
    const theirs = strip(svgOf(render(<Lucide />).container).outerHTML);
    expect(ours).toBe(theirs);
  });
});
