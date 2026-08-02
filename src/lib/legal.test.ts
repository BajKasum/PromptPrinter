import { describe, expect, it } from "vitest";
import { LEGAL } from "@/lib/legal";

// Every value in LEGAL is rendered verbatim into Impressum, Datenschutz, AGB
// and Rückerstattung. A leftover placeholder therefore does not look like an
// unfinished config value — it stands as literal text on a public legal page
// and makes the statement it belongs to worthless.
//
// That is not hypothetical: `appHost` shipped as
// "[HOSTING-ANBIETER, z. B. Vercel Inc., USA]" and rendered twice in the
// privacy policy, including inside the sentence naming which recipients get
// data transferred to the USA. This suite exists so the next placeholder
// fails the build instead of the launch.

describe("LEGAL", () => {
  const entries = Object.entries(LEGAL) as [string, string][];

  it.each(entries)("%s carries no unfilled placeholder", (_name, value) => {
    expect(value).not.toMatch(/\[.*\]/);
    expect(value.toUpperCase()).not.toContain("PLATZHALTER");
    expect(value.toUpperCase()).not.toContain("TODO");
  });

  // companyId is the one deliberately empty field: Kasum trades as a private
  // individual with no commercial-register entry, and the Impressum drops the
  // whole line when it is blank. Everything else must be present.
  it.each(entries.filter(([name]) => name !== "companyId"))(
    "%s is actually filled in",
    (_name, value) => {
      expect(value.trim().length).toBeGreaterThan(0);
    }
  );

  it("names a concrete hosting provider, since the privacy policy attributes a data transfer to it", () => {
    expect(LEGAL.appHost).toBe("Vercel Inc., USA");
  });

  it("states the Supabase region, verified against the live project as eu-west-1", () => {
    expect(LEGAL.dataRegion).toContain("EU");
  });
});
