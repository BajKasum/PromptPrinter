import { readFileSync } from "node:fs";
import { join } from "node:path";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { de } from "@/shared/i18n/messages/de";
import { ABOUT_ME_MAX_LENGTH } from "@/shared/lib/about-me";

const update = vi.fn();
const eq = vi.fn();
const toast = vi.fn();

vi.mock("@/shared/supabase/client", () => ({
  createClient: () => ({
    from: (table: string) => ({
      update: (patch: unknown) => {
        update(table, patch);
        return { eq: (col: string, val: string) => (eq(col, val), Promise.resolve({ error: null })) };
      },
    }),
  }),
}));
vi.mock("@/shared/ui/toast", () => ({ useToast: () => ({ toast }) }));

import { AboutMe } from "./about-me";

describe("AboutMe", () => {
  beforeEach(() => {
    update.mockReset();
    eq.mockReset();
    toast.mockReset();
  });

  it("speichert den getrimmten Text in profiles.about_me, nur für das eigene Profil", async () => {
    render(<AboutMe userId="u1" initialAboutMe="" />);
    const field = screen.getByLabelText(de.aboutMe.label);
    const save = screen.getByRole("button", { name: de.aboutMe.save });
    expect(save).toBeDisabled();

    fireEvent.change(field, { target: { value: "  Lehrerin, lockerer Ton  " } });
    fireEvent.click(save);

    await waitFor(() => expect(update).toHaveBeenCalledWith("profiles", { about_me: "Lehrerin, lockerer Ton" }));
    expect(eq).toHaveBeenCalledWith("id", "u1");
    await waitFor(() => expect(toast).toHaveBeenCalledWith(expect.objectContaining({ variant: "success" })));
  });

  it("begrenzt das Feld auf die Grenze der Datenbank und sagt, was nicht hineingehört", () => {
    render(<AboutMe userId="u1" initialAboutMe="Hallo" />);
    expect(screen.getByLabelText(de.aboutMe.label)).toHaveAttribute("maxLength", String(ABOUT_ME_MAX_LENGTH));
    expect(screen.getByText(de.aboutMe.privacy)).toBeInTheDocument();
    expect(de.aboutMe.privacy).toMatch(/Kontaktdaten/);
  });

  it("hält dieselbe Grenze wie die Migration", () => {
    const sql = readFileSync(join(process.cwd(), "supabase", "migrations", "0056_profile_about_me.sql"), "utf8");
    expect(sql).toContain(`check (char_length(about_me) <= ${ABOUT_ME_MAX_LENGTH})`);
    expect(sql).toMatch(/grant update \(about_me\) on public\.profiles to authenticated/);
  });
});
