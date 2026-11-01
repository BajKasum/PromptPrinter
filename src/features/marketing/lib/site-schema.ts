import { PLANS, PRO_PRICE_EUR } from "@/shared/lib/pricing";
import { LOCALES } from "@/shared/i18n/locales";
import { LEGAL } from "@/shared/lib/legal";
import { SITE_DESCRIPTION } from "@/shared/lib/site-description";
import { siteUrl } from "@/shared/lib/site-url";
import { AUTHOR_PATH, entityIds } from "./entity-ids";

// Die Structured Data, die mehrere Seiten teilen: die Organisation und die Website im Layout aller öffentlichen
// Seiten, die Software auf der Startseite, die Person auf /ueber. Jeder Knoten steht hier einmal und trägt seine
// feste @id (entity-ids.ts); Artikel, Website und Software verweisen mit derselben @id darauf.
//
// `sameAs` fehlt mit Absicht: Structured Data darf nichts behaupten, was die Seite nicht zeigt, und auf keiner
// öffentlichen Seite ist ein Profil verlinkt, das die Marke eindeutig macht (das Repository promptprinter-pp
// steht nur auf /skill). Sobald /ueber oder der Footer das GitHub-Profil oder -Repository zeigen, gehört die
// Adresse hier in `organization.sameAs`.

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

// Die Preise sind dieselben zwei Zahlen wie auf /pricing (PLANS in shared/lib/pricing.ts, eine Quelle), kein
// zweiter, potenziell driftender Preis. Bewusst KEIN `aggregateRating`: es gibt keine echten Bewertungen, eine
// erfundene Zahl wäre genau der Structured-Data-Missbrauch, den Google abstraft. Kategorie und Angebote sind
// Kasums Entscheid (#127) und bleiben, wie sie sind.
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
    offers: PLANS.map((plan) => ({
      "@type": "Offer",
      name: plan.name,
      price: plan.name === "Pro" ? PRO_PRICE_EUR.toFixed(2) : "0.00",
      priceCurrency: "EUR",
      description: plan.description,
    })),
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
