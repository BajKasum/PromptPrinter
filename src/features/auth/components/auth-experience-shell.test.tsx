import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { AuthExperienceShell } from "./auth-experience-shell";

// Anmelden, Registrieren und das Zurücksetzen des Passworts teilen diese Hülle. Wo der Server die Seite rendert,
// muss das Formular ab dem ersten Bild sichtbar sein: auf dem Handy ist ein Absatz darin das grösste Element der
// Seite, und ein Einstieg mit opacity 0 hielte ihn bis nach dem Hydrieren zurück.

describe("AuthExperienceShell", () => {
  it("zeigt das Formular ohne opacity 0, mit dem CSS-Einstieg", () => {
    render(
      <AuthExperienceShell>
        <p>Formular</p>
      </AuthExperienceShell>
    );
    const child = screen.getByText("Formular");
    const rise = child.closest<HTMLElement>(".enter-rise");
    expect(rise).not.toBeNull();
    expect(rise!.style.animationDuration).toBe("0.4s");
    expect(rise!.className).toContain("max-w-md");
    for (let el: HTMLElement | null = child; el; el = el.parentElement) {
      expect(el.style.opacity, "ein Vorfahr liefert opacity 0 aus").not.toBe("0");
    }
  });

  it("hält Finns Spalte und den kleinen Finn für das Handy", () => {
    render(
      <AuthExperienceShell panelTitle="Hallo">
        <p>Formular</p>
      </AuthExperienceShell>
    );
    expect(screen.getByRole("heading", { name: "Hallo" })).toBeInTheDocument();
    expect(screen.getByRole("main")).toContainElement(screen.getByText("Formular"));
  });
});
