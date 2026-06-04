import type { Metadata } from "next";
import { LegalShell } from "@/components/marketing/legal-shell";
import { LEGAL } from "@/lib/legal";

export const metadata: Metadata = {
  title: "Impressum",
  description: "Anbieterkennzeichnung und Kontaktangaben zu PromptPrinter.",
};

export default function ImpressumPage() {
  return (
    <LegalShell badge="Rechtliches" title="Impressum" updated={LEGAL.lastUpdated}>
      <h2>Anbieter</h2>
      <p>
        <strong>{LEGAL.operator}</strong>
        <br />
        {LEGAL.street}
        <br />
        {LEGAL.postalCity}
        <br />
        {LEGAL.country}
      </p>
      {LEGAL.companyId && (
        <p>
          Handelsregister-/UID-Nummer: <strong>{LEGAL.companyId}</strong>
        </p>
      )}

      <h2>Kontakt</h2>
      <p>
        E-Mail: <a href={`mailto:${LEGAL.email}`}>{LEGAL.email}</a>
      </p>

      <h2>Verantwortlich für den Inhalt</h2>
      <p>{LEGAL.operator}</p>

      <h2>Haftung für Inhalte</h2>
      <p>
        Die Inhalte dieser Website wurden mit grösstmöglicher Sorgfalt erstellt. Für die
        Richtigkeit, Vollständigkeit und Aktualität der Inhalte wird jedoch keine Gewähr übernommen.
        Als Diensteanbieter sind wir für eigene Inhalte auf diesen Seiten nach den allgemeinen
        Gesetzen verantwortlich.
      </p>

      <h2>Haftung für Links</h2>
      <p>
        Unser Angebot enthält gegebenenfalls Links zu externen Websites Dritter, auf deren Inhalte
        wir keinen Einfluss haben. Für diese fremden Inhalte ist stets der jeweilige Anbieter oder
        Betreiber der Seiten verantwortlich. Eine permanente inhaltliche Kontrolle der verlinkten
        Seiten ist ohne konkrete Anhaltspunkte einer Rechtsverletzung nicht zumutbar.
      </p>

      <h2>Urheberrecht</h2>
      <p>
        Die durch den Betreiber erstellten Inhalte und Werke auf diesen Seiten unterliegen dem
        Urheberrecht. Beiträge Dritter sind als solche gekennzeichnet. Vervielfältigung, Bearbeitung
        und jede Art der Verwertung ausserhalb der Grenzen des Urheberrechts bedürfen der
        schriftlichen Zustimmung des jeweiligen Urhebers.
      </p>

      <h2>Datenschutz</h2>
      <p>
        Informationen zur Bearbeitung deiner Personendaten findest du in unserer{" "}
        <a href="/datenschutz">Datenschutzerklärung</a>.
      </p>
    </LegalShell>
  );
}
