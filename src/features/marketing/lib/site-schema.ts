import { LOCALES } from "@/shared/i18n/locales";
import { LEGAL } from "@/shared/lib/legal";
import { SITE_DESCRIPTION } from "@/shared/lib/site-description";
import { siteUrl } from "@/shared/lib/site-url";
import { AUTHOR_PATH, entityIds } from "./entity-ids";
import { FREE_OFFER_TEXT, REPO_URL } from "./open-source";

// Die Structured Data, die mehrere Seiten teilen: die Organisation und die Website im Layout aller öffentlichen
// Seiten, die Software auf der Startseite, die Person auf /ueber. Jeder Knoten steht hier einmal und trägt seine
// feste @id (entity-ids.ts); Artikel, Website und Software verweisen mit derselben @id darauf.
//
// `organization.sameAs` nennt genau das Repository, das der Footer auf jeder öffentlichen Seite verlinkt: Structured
// Data darf nichts behaupten, was die Seite nicht zeigt. Ein weiteres Profil kommt erst dazu, wenn eine Seite es zeigt.

const [postalCode, ...cityParts] = LEGAL.postalCity.split(" ");

/** Verweis auf die Person mit Namen, damit auch eine Seite, die den Knoten nicht selbst führt, den Autor kennt. */
export function personRef() {
  const base = siteUrl();
  return { "@type": "Person", "@id": entityIds().person, name: LEGAL.operator, url: `${base}${AUTHOR_PATH}` };
}

/** Verweis auf die Organisation mit Namen und Logo, für den Herausgeber eines Artikels. */
export function organizationRef() {
  const base = siteUrl();
  return {
    "@type": "Organization",
    "@id": entityIds().organization,
    name: "PromptPrinter",
    url: base,
    logo: { "@type": "ImageObject", url: `${base}/apple-icon.png` },
  };
}

export function organizationJsonLd() {
  const base = siteUrl();
  return {
    "@context": "https://schema.org",
    "@type": "Organization",
    "@id": entityIds().organization,
    name: "PromptPrinter",
    url: base,
    logo: `${base}/apple-icon.png`,
    description: SITE_DESCRIPTION,
    founder: personRef(),
    email: LEGAL.email,
    sameAs: [REPO_URL],
    address: {
      "@type": "PostalAddress",
      streetAddress: LEGAL.street,
      postalCode,
      addressLocality: cityParts.join(" "),
      addressCountry: "CH",
    },
  };
}

export function websiteJsonLd() {
  return {
    "@context": "https://schema.org",
    "@type": "WebSite",
    "@id": entityIds().website,
    name: "PromptPrinter",
    url: siteUrl(),
    description: SITE_DESCRIPTION,
    inLanguage: "de",
    publisher: { "@id": entityIds().organization },
  };
}

// Ein Angebot zum Preis 0: PromptPrinter kostet nichts (/open-source). Bewusst KEIN `aggregateRating`: es gibt
// keine echten Bewertungen, eine erfundene Zahl wäre genau der Structured-Data-Missbrauch, den Google abstraft. Die
// Kategorie ist Kasums Entscheid (#127) und bleibt, wie sie ist.
export function softwareApplicationJsonLd() {
  return {
    "@context": "https://schema.org",
    "@type": "SoftwareApplication",
    "@id": entityIds().software,
    name: "PromptPrinter",
    url: siteUrl(),
    description: SITE_DESCRIPTION,
    applicationCategory: "DeveloperApplication",
    operatingSystem: "Web",
    // Die Oberfläche der App; die Hilfe nennt die Sprachen im Artikel "Konto und Daten".
    inLanguage: [...LOCALES],
    publisher: { "@id": entityIds().organization },
    offers: [
      {
        "@type": "Offer",
        name: "Free",
        price: "0.00",
        priceCurrency: "EUR",
        description: FREE_OFFER_TEXT,
      },
    ],
  };
}

export function profilePageJsonLd() {
  return {
    "@context": "https://schema.org",
    "@type": "ProfilePage",
    url: siteUrl(AUTHOR_PATH),
    mainEntity: personRef(),
  };
}
