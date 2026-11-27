import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { Lock } from "lucide-react";
import { hslVar } from "@/shared/lib/utils";
import { Field, InfoRow, SettingsCard } from "@/features/settings/components/settings-card";

const card = (props: Partial<Parameters<typeof SettingsCard>[0]> = {}) =>
  render(
    <SettingsCard Icon={Lock} accent="--accent" title="Sicherheit" description="Ändere dein Passwort." {...props}>
      <p>Inhalt der Karte</p>
    </SettingsCard>
  );

describe("SettingsCard", () => {
  it("ist ein Abschnitt mit Titel (Ebene 2), Beschreibung und dem Inhalt darunter", () => {
    const { container } = card();
    expect(container.querySelector("section")).toBeInTheDocument();
    expect(screen.getByRole("heading", { level: 2, name: "Sicherheit" })).toBeInTheDocument();
    expect(screen.getByText("Ändere dein Passwort.")).toBeInTheDocument();
    expect(screen.getByText("Inhalt der Karte")).toBeInTheDocument();
  });

  it("trägt den Sprunganker nur, wenn einer gesetzt ist", () => {
    const { container, unmount } = card({ id: "api-keys" });
    expect(container.querySelector("section")?.id).toBe("api-keys");
    unmount();
    const second = card();
    expect(second.container.querySelector("section")?.hasAttribute("id")).toBe(false);
  });

  it("färbt Symbol und Eckenglanz mit dem Akzent (eine Design-Variable, nie eine feste Farbe)", () => {
    const { container } = card({ accent: "--destructive" });
    expect(container.querySelector("header svg")?.getAttribute("style")).toContain(hslVar("--destructive").replaceAll(" ", ""));
    const glow = container.querySelector("section > div.blur-3xl");
    expect(glow?.getAttribute("style")).toContain("--destructive");
  });

  it("zeigt den freien Inhalt (headerRight) rechts im Kopf", () => {
    const { container } = card({ headerRight: <span>frei</span> });
    expect(container.querySelector("header")?.lastElementChild?.textContent).toBe("frei");
  });

  it("hängt eine zusätzliche Klasse an, ohne die eigene zu verlieren, und lässt den Anker unter die feste Kopfzeile scrollen", () => {
    const { container } = card({ className: "md:col-span-2" });
    const section = container.querySelector("section");
    expect(section).toHaveClass("md:col-span-2", "scroll-mt-24", "rounded-2xl", "border-border");
  });
});

describe("Field", () => {
  it("zeigt die Beschriftung als Text über dem Inhalt (kein <label>, das Eingabefeld beschriftet sich selbst)", () => {
    const { container } = render(
      <Field label="Anzeigename">
        <input aria-label="Anzeigename" />
      </Field>
    );
    const label = container.querySelector("span.block");
    expect(label?.textContent).toBe("Anzeigename");
    expect(container.querySelector("label")).toBeNull();
    expect(screen.getByLabelText("Anzeigename")).toBeInTheDocument();
  });
});

describe("InfoRow", () => {
  it("zeigt Beschriftung links und Wert rechts", () => {
    const { container } = render(<InfoRow label="Rolle" value="Eigentümer" />);
    const spans = container.querySelectorAll("div > span");
    expect(spans[0].textContent).toBe("Rolle");
    expect(spans[1].textContent).toBe("Eigentümer");
  });
});
