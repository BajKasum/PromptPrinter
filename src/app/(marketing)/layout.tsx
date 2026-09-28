import { Navbar } from "@/features/marketing/components/navbar";
import { Footer } from "@/features/marketing/components/footer";
import { JsonLd } from "@/shared/ui/json-ld";
import { LEGAL } from "@/shared/lib/legal";
import { siteUrl } from "@/shared/lib/site-url";

// Die Hülle der öffentlichen Website: eine Navbar, ein Footer, ein <main>.
//
// Vorher gab es diese fünf Zeilen dreimal in drei Ausprägungen — fünf Seiten
// bauten sie von Hand nach, LegalShell hatte ihre eigene Kopie, DocsShell noch
// eine. Navbar und Footer hatten dadurch je sieben Aufrufer statt einem, und
// jede Änderung an der öffentlichen Hülle (Nav-Punkt, Cookie-Hinweis,
// Skip-Link, Analytics) war eine Änderung an bis zu sieben Stellen mit der
// Möglichkeit, eine zu vergessen. Genau dieser Fehlertyp ist in diesem Projekt
// schon zweimal aufgetreten (Sidebar Desktop/Mobile, zwei api-problem-Kopien).
//
// Der Skip-Link bleibt unberührt: er steht in der Navbar und zeigt auf
// #main-content, und dieses Ziel setzt weiterhin jede Seite selbst auf ihren
// ersten Inhaltsabschnitt (Hero, PageHeader, LegalShell, DocsShell). Die
// Navbar liegt innerhalb von <main>, deshalb kann der Anker nicht auf <main>
// selbst sitzen — er würde den Fokus vor die Navigation setzen statt dahinter.
// Sitewide Identität für Suchmaschinen (Knowledge-Panel-Kandidat) und für
// generative Engines, die beim Beantworten einer Frage zuerst grundlegende
// Fakten über eine Marke suchen. Nur in dieser Layout-Ebene, nicht im
// Root-Layout: sie umschliesst genau die indexierbaren Seiten (Landing,
// Preise, Über, Kontakt, Docs, Recht), nicht die eingeloggte App, die
// robots.ts ohnehin vom Crawling ausschliesst. Adresse/E-Mail kommen aus
// derselben LEGAL-Quelle wie Impressum und Datenschutz, keine zweite
// Behauptung derselben Fakten.
const [postalCode, ...cityParts] = LEGAL.postalCity.split(" ");

function buildJsonLd() {
  const base = siteUrl();
  const organization = {
    "@context": "https://schema.org",
    "@type": "Organization",
    name: "PromptPrinter",
    url: base,
    logo: `${base}/apple-icon.png`,
    founder: { "@type": "Person", name: LEGAL.operator },
    email: LEGAL.email,
    address: {
      "@type": "PostalAddress",
      streetAddress: LEGAL.street,
      postalCode,
      addressLocality: cityParts.join(" "),
      addressCountry: "CH",
    },
  };
  const website = {
    "@context": "https://schema.org",
    "@type": "WebSite",
    name: "PromptPrinter",
    url: base,
  };
  return { organization, website };
}

export default function MarketingLayout({ children }: { children: React.ReactNode }) {
  const { organization, website } = buildJsonLd();
  return (
    <main className="relative">
      <JsonLd data={organization} />
      <JsonLd data={website} />
      <Navbar />
      {children}
      <Footer />
    </main>
  );
}
