import { readFileSync } from "node:fs";
import { join } from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import { SITE_DESCRIPTION } from "@/shared/lib/site-description";
import { articleJsonLd } from "./article-schema";
import { entityIds } from "./entity-ids";
import { REPO_URL } from "./open-source";
import {
  organizationJsonLd,
  profilePageJsonLd,
  softwareApplicationJsonLd,
  websiteJsonLd,
} from "./site-schema";

// #248: die Knoten der Structured Data hängen über feste @id zusammen. Dieser Test hält fest, dass jeder Verweis
// auf einen Knoten zeigt, den eine Seite wirklich führt, und dass keine @id verwaist oder doppelt vergeben ist.

const ORIGIN = "https://staging.example.com";

afterEach(() => {
  vi.unstubAllEnvs();
});

function build() {
  vi.stubEnv("NEXT_PUBLIC_APP_URL", ORIGIN);
  const organization = organizationJsonLd();
  const website = websiteJsonLd();
  const software = softwareApplicationJsonLd();
  const profile = profilePageJsonLd();
  const article = articleJsonLd({
    headline: "x",
    description: "y",
    path: "/docs/erste-schritte",
    published: "2026-07-25",
    updated: "2026-10-01",
  });
  return { organization, website, software, profile, article };
}

/** Jeder Wert eines `@id`-Schlüssels irgendwo im Baum. */
function idsIn(value: unknown): string[] {
  if (Array.isArray(value)) return value.flatMap(idsIn);
  if (value && typeof value === "object") {
    return Object.entries(value).flatMap(([key, child]) =>
      key === "@id" && typeof child === "string" ? [child] : idsIn(child)
    );
  }
  return [];
}

describe("entityIds", () => {
  it("baut jede Adresse aus der konfigurierten Origin und vergibt keine doppelt", () => {
    vi.stubEnv("NEXT_PUBLIC_APP_URL", ORIGIN);
    const ids = Object.values(entityIds());

    for (const id of ids) expect(id.startsWith(`${ORIGIN}/`)).toBe(true);
    expect(new Set(ids).size).toBe(ids.length);
    expect(entityIds().person).toBe(`${ORIGIN}/ueber#person`);
  });
});

describe("Structured Data der öffentlichen Seiten", () => {
  it("führt Organisation, Website und Software unter ihrer festen @id", () => {
    const { organization, website, software } = build();
    const ids = entityIds();

    expect(organization["@id"]).toBe(ids.organization);
    expect(website["@id"]).toBe(ids.website);
    expect(software["@id"]).toBe(ids.software);
  });

  it("führt die Person von /ueber unter der @id, auf die Autor und Gründer zeigen", () => {
    const { profile, organization, article } = build();
    const personId = entityIds().person;

    expect(profile.mainEntity["@id"]).toBe(personId);
    expect(organization.founder["@id"]).toBe(personId);
    expect((article.author as { "@id": string })["@id"]).toBe(personId);
  });

  it("lässt den Herausgeber eines Artikels auf die Organisation aus dem Layout zeigen", () => {
    const { organization, article } = build();

    expect((article.publisher as { "@id": string })["@id"]).toBe(organization["@id"]);
  });

  it("lässt Website und Software auf dieselbe Organisation zeigen", () => {
    const { organization, website, software } = build();

    expect(website.publisher["@id"]).toBe(organization["@id"]);
    expect(software.publisher["@id"]).toBe(organization["@id"]);
  });

  it("lässt keinen Verweis ins Leere laufen", () => {
    const { organization, website, software, profile, article } = build();
    const defined = new Set([
      organization["@id"],
      website["@id"],
      software["@id"],
      profile.mainEntity["@id"],
    ]);

    for (const node of [organization, website, software, profile, article]) {
      for (const id of idsIn(node)) expect(defined.has(id), id).toBe(true);
    }
  });

  it("nimmt die Beschreibung aus derselben Quelle wie die Meta-Beschreibung", () => {
    const { organization, website, software } = build();

    expect(organization.description).toBe(SITE_DESCRIPTION);
    expect(website.description).toBe(SITE_DESCRIPTION);
    expect(software.description).toBe(SITE_DESCRIPTION);
    expect(software.url).toBe(ORIGIN);
  });

  // Die Kategorie hat Kasum in #127 so entschieden, sie bleibt. PromptPrinter kostet nichts: ein Angebot, Preis 0.
  it("lässt die Kategorie unverändert und bietet die Software nur kostenlos an", () => {
    const { software } = build();

    expect(software.applicationCategory).toBe("DeveloperApplication");
    expect(software.offers).toHaveLength(1);
    expect(software.offers[0]).toMatchObject({ name: "Free", price: "0.00", priceCurrency: "EUR" });
    expect(software.offers[0].description).toContain("Open Source");
  });

  // Structured Data darf nichts behaupten, was keine Seite zeigt: sameAs nennt nur das Repository, das der Footer
  // auf jeder öffentlichen Seite verlinkt, und steht nur an der Organisation.
  it("nennt als sameAs genau das Repository aus dem Footer", () => {
    const { organization, website, software, profile } = build();

    expect(organization.sameAs).toEqual([REPO_URL]);
    expect(readFileSync(join(process.cwd(), "src/features/marketing/components/footer.tsx"), "utf8")).toContain(
      "href={REPO_URL}"
    );
    for (const node of [website, software, profile]) {
      expect(JSON.stringify(node)).not.toContain("sameAs");
    }
  });
});
