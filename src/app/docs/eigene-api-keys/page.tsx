import type { Metadata } from "next";
import Link from "next/link";
import { DocsShell } from "@/components/marketing/docs-shell";
import { docBySlug } from "@/shared/lib/docs-nav";

const doc = docBySlug("eigene-api-keys")!;

export const metadata: Metadata = {
  title: doc.title,
  description: doc.summary,
};

export default function Page() {
  return (
    <DocsShell
      slug={doc.slug}
      title="Eigene API-Keys"
      intro="Du kannst PromptPrinter mit deinem eigenen Modell-Zugang betreiben. Dann läuft alles über dein Konto, und die Nachrichtenlimits fallen weg."
    >
      <h2>Warum das eine gute Idee sein kann</h2>
      <p>
        Standardmässig läuft der Chat über meinen Modellzugang, und dafür gibt es
        ein monatliches Nachrichtenkontingent, sonst wird das für ein
        Solo-Projekt schlicht unbezahlbar. Hinterlegst du deinen eigenen Key,
        zahlst du das Modell direkt bei deinem Anbieter, und mein Limit gilt für
        dich nicht mehr.
      </p>
      <p>
        Das ist auch der Grund, warum der Free-Plan echt nutzbar ist und nicht
        nur eine Testphase: mit eigenem Key kostet dich PromptPrinter nichts.
      </p>

      <h2>Einrichten</h2>
      <p>
        Unter <strong>Einstellungen → Eigene API-Keys</strong> wählst du deinen
        Anbieter und fügst den Key ein. Vor dem Speichern wird er einmal
        testweise benutzt, ein Tippfehler oder ein abgelaufener Key fällt also
        sofort auf und nicht erst mitten im Arbeiten.
      </p>

      <h2>Welche Anbieter gehen</h2>
      <ul>
        <li>
          <strong>Anthropic</strong> (Claude)
        </li>
        <li>
          <strong>OpenAI</strong>
        </li>
        <li>
          <strong>Google Gemini</strong>
        </li>
        <li>
          <strong>Eigener Endpunkt</strong>, für alles, was die
          OpenAI-kompatible Schnittstelle spricht: Z.ai, DeepSeek, Groq,
          OpenRouter, ein eigenes Gateway. Hier gibst du zusätzlich Adresse und
          Modellnamen an.
        </li>
      </ul>

      <h2>Wie der Key gespeichert wird</h2>
      <p>
        Verschlüsselt, mit AES-256-GCM. Der Schlüssel dafür liegt ausserhalb der
        Datenbank auf dem Server, ein Datenbank-Abzug allein ergibt also keine
        brauchbaren Keys. Angezeigt wird dein Key nach dem Speichern nie wieder,
        du kannst ihn nur ersetzen oder entfernen.
      </p>

      <h2>Was der eigene Key ändert</h2>
      <ul>
        <li>Deine Anfragen laufen über dein Anbieterkonto, nicht über meines.</li>
        <li>
          Das monatliche Nachrichtenlimit greift nicht mehr, siehe{" "}
          <Link href="/docs/plaene-und-limits">Pläne und Limits</Link>.
        </li>
        <li>
          Der Missbrauchsschutz pro Stunde bleibt bestehen, der schützt den
          Server, nicht das Budget.
        </li>
        <li>Die Modellkosten stehen auf deiner Rechnung beim Anbieter.</li>
      </ul>

      <h2>Nur für eigene Endpunkte: was geprüft wird</h2>
      <p>
        Trägst du eine eigene Adresse ein, muss sie <code>https</code> sein und
        auf ein öffentlich erreichbares Ziel zeigen. Adressen, die in interne
        Netze zeigen, werden abgelehnt. Das ist eine Sicherheitsmassnahme gegen
        Missbrauch des Servers und lässt sich nicht umgehen.
      </p>

      <h2>Wieder entfernen</h2>
      <p>
        In denselben Einstellungen kannst du den Key jederzeit löschen. Danach
        läuft alles wieder über meinen Zugang, samt des dazugehörigen
        monatlichen Kontingents.
      </p>
    </DocsShell>
  );
}
