import type { Metadata } from "next";
import Link from "next/link";
import { DocsShell } from "@/features/marketing/components/docs-shell";
import { docBySlug } from "@/shared/lib/docs-nav";
import { docMetadata } from "@/features/marketing/lib/article-metadata";

const doc = docBySlug("eigene-api-keys")!;

export const metadata: Metadata = docMetadata(doc);

export default function Page() {
  return (
    <DocsShell
      slug={doc.slug}
      title="Eigene API-Keys"
      intro="Du kannst PromptPrinter mit deinem eigenen Modell-Zugang betreiben. Dann läuft alles über dein Konto, und die Nachrichtenlimits fallen weg."
    >
      <h2>Warum einen eigenen API-Key nutzen?</h2>
      <p>
        Ohne Key laufen die ersten drei Prompts über meinen Modellzugang, danach
        nicht mehr: für alle und ohne Ende wäre das für ein Solo-Projekt
        schlicht unbezahlbar. Hinterlegst du deinen eigenen Key, zahlst du das
        Modell direkt bei deinem Anbieter, und es gibt kein Nachrichtenlimit.
      </p>
      <p>
        Das ist auch der Grund, warum PromptPrinter kostenlos bleiben kann und
        keine Testphase ist: mit eigenem Key kostet es dich nichts.
      </p>

      <h2>Wie bekomme ich einen kostenlosen Gemini-Key?</h2>
      <p>
        Wenn du noch keinen Key hast, ist der von Google der einfachste Weg.
        So kommst du dazu:
      </p>
      <ol>
        <li>
          Öffne{" "}
          <a
            href="https://aistudio.google.com/apikey"
            target="_blank"
            rel="noopener noreferrer"
          >
            Google AI Studio
          </a>{" "}
          und melde dich mit deinem Google-Konto an.
        </li>
        <li>
          Klicke auf <strong>Create API key</strong> und kopiere den Key.
        </li>
        <li>
          Füge ihn in PromptPrinter ein, wie im nächsten Abschnitt beschrieben.
        </li>
      </ol>
      <p>
        Der Gratis-Zugang von Google hat Limits, die du in AI Studio siehst.
        Zu deinen Daten: In der EU, der Schweiz und Grossbritannien gelten laut
        Googles{" "}
        <a
          href="https://ai.google.dev/gemini-api/terms"
          target="_blank"
          rel="noopener noreferrer"
        >
          Bedingungen
        </a>{" "}
        die Regeln der bezahlten Dienste auch für den Gratis-Zugang.
        Anderswo darf Google Eingaben aus dem Gratis-Zugang zur Verbesserung
        seiner Produkte nutzen.
      </p>

      <h2>Wie richte ich meinen API-Key ein?</h2>
      <p>
        Unter <strong>Einstellungen → Eigene API-Keys</strong> fügst du einfach
        deinen Key ein, welcher Anbieter das ist, erkenne ich am Key selbst.
        Vor dem Speichern wird er einmal testweise benutzt, ein Tippfehler oder
        ein abgelaufener Key fällt also sofort auf und nicht erst mitten im
        Arbeiten.
      </p>

      <h2>Welche Anbieter werden unterstützt?</h2>
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

      <h2>Wie wird mein API-Key gespeichert?</h2>
      <p>
        Verschlüsselt, mit AES-256-GCM. Der Schlüssel dafür liegt ausserhalb der
        Datenbank auf dem Server, ein Datenbank-Abzug allein ergibt also keine
        brauchbaren Keys. Angezeigt wird dein Key nach dem Speichern nie wieder,
        du kannst ihn nur ersetzen oder entfernen.
      </p>

      <h2>Was ändert sich mit einem eigenen Key?</h2>
      <ul>
        <li>Deine Anfragen laufen über dein Anbieterkonto, nicht über meines.</li>
        <li>
          Nach den drei Gratis-Prompts chattest du ohne Nachrichtenlimit weiter, siehe{" "}
          <Link href="/docs/plaene-und-limits">Pläne und Limits</Link>.
        </li>
        <li>
          Der Missbrauchsschutz pro Stunde bleibt bestehen, der schützt den
          Server, nicht das Budget.
        </li>
        <li>Die Modellkosten stehen auf deiner Rechnung beim Anbieter.</li>
      </ul>

      <h2>Was wird bei einem eigenen Endpunkt geprüft?</h2>
      <p>
        Trägst du eine eigene Adresse ein, muss sie <code>https</code> sein und
        auf ein öffentlich erreichbares Ziel zeigen. Adressen, die in interne
        Netze zeigen, werden abgelehnt. Das ist eine Sicherheitsmassnahme gegen
        Missbrauch des Servers und lässt sich nicht umgehen.
      </p>

      <h2>Wie entferne ich meinen Key wieder?</h2>
      <p>
        In denselben Einstellungen kannst du einen Key jederzeit löschen.
        Löschst du den letzten, bleiben dir nur die drei Gratis-Prompts, soweit
        du sie noch nicht verbraucht hast; danach läuft ohne Key kein Chat mehr.
        Deine Chats
        und Projekte bleiben dabei erhalten, und einen neuen Key kannst du
        jederzeit wieder hinterlegen.
      </p>
    </DocsShell>
  );
}
