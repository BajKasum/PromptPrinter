import type { Metadata } from "next";
import { LegalShell } from "@/features/marketing/components/legal-shell";
import { LEGAL } from "@/shared/lib/legal";

export const metadata: Metadata = {
  title: "Rückerstattung",
  description:
    "Wann du dein Geld zurückbekommst, wie du eine Erstattung anforderst und was davon ausgenommen ist.",
};

export default function RueckerstattungPage() {
  return (
    <LegalShell
      badge="Rechtliches"
      title="Rückerstattung"
      intro="Kurz: Wenn Pro nicht das ist, was du erwartet hast, bekommst du dein Geld zurück. Ohne dass du dir eine Begründung ausdenken musst."
      updated={LEGAL.lastUpdated}
    >
      <h2>Wer dein Geld hat</h2>
      <p>
        Der Kauf läuft über <strong>Lemon Squeezy</strong>, den Zahlungsanbieter
        hinter PromptPrinter. Lemon Squeezy verkauft dabei in eigenem Namen und
        stellt dir die Rechnung. Für eine Erstattung wendest du dich trotzdem
        einfach an mich, ich stosse sie dort an. Du musst dich nicht selbst
        durch ein fremdes Portal arbeiten.
      </p>

      <h2>14 Tage Geld zurück</h2>
      <p>
        Auf deine <strong>erste Zahlung für Pro</strong> gibt es 14 Tage
        Geld-zurück-Garantie. Du musst nichts begründen, eine Mail genügt. Der
        Betrag wird vollständig erstattet, und dein Konto wechselt zurück auf
        den Free-Plan.
      </p>
      <p>
        Deine Inhalte bleiben dabei erhalten. Chats, Projekte und gespeicherte
        Prompts verschwinden nicht, es greifen wieder die Grenzen des
        Free-Plans.
      </p>

      <h2>Kündigung und Verlängerung</h2>
      <p>
        Ein Abonnement verlängert sich automatisch, bis du kündigst. Du kannst
        jederzeit kündigen und behältst den Pro-Zugang bis zum Ende des bereits
        bezahlten Zeitraums, es wird nichts anteilig zurückgerechnet, du
        verlierst aber auch keinen Tag, den du bezahlt hast.
      </p>
      <p>
        Eine Kündigung ist keine Erstattung. Wenn du dein Geld zurückwillst und
        noch innerhalb der 14 Tage bist, sag das ausdrücklich dazu.
      </p>

      <h2>Wenn etwas nicht funktioniert</h2>
      <p>
        Unabhängig von der 14-Tage-Frist gilt: Wenn Pro über einen längeren
        Zeitraum nicht nutzbar war, weil auf meiner Seite etwas kaputt war, ist
        das keine Kulanzfrage. Schreib mir, und wir finden eine faire Lösung,
        Erstattung oder Verlängerung des Zeitraums.
      </p>

      <h2>Was nicht erstattet wird</h2>
      <ul>
        <li>
          Verlängerungen nach dem ersten Zeitraum, wenn du schlicht vergessen
          hast, rechtzeitig zu kündigen. Kündige lieber einmal zu früh, der
          Zugang bleibt ja bis zum Ende bestehen.
        </li>
        <li>
          Kosten bei <em>deinem eigenen</em> Modellanbieter. Wenn du einen
          eigenen API-Key hinterlegst, rechnest du direkt mit Anthropic, OpenAI,
          Google oder deinem Anbieter ab. Auf diese Beträge habe ich keinen
          Zugriff und kann sie nicht erstatten.
        </li>
        <li>
          Unzufriedenheit mit dem, was ein KI-Modell inhaltlich ausgibt.
          Ergebnisse können danebenliegen, das ist die Natur der Sache und in den{" "}
          <a href="/agb">AGB</a> ausdrücklich festgehalten.
        </li>
        <li>
          Konten, die wegen eines Verstosses gegen die <a href="/agb">AGB</a>{" "}
          gesperrt wurden.
        </li>
      </ul>

      <h2>So forderst du eine Erstattung an</h2>
      <p>
        Eine formlose Mail an <a href={`mailto:${LEGAL.email}`}>{LEGAL.email}</a>{" "}
        mit der E-Mail-Adresse deines Kontos reicht. Betreff „Rückerstattung“
        hilft mir beim Sortieren.
      </p>
      <p>
        Ich bestätige den Eingang und stosse die Erstattung an. Wie lange es
        danach dauert, bis das Geld wieder bei dir ist, hängt von deinem
        Zahlungsmittel ab, üblich sind einige Werktage.
      </p>

      <h2>Zahlungsabwicklung</h2>
      <p>
        Der Verkauf von Pro wird über einen externen Zahlungsdienstleister
        laufen, der zugleich dein Vertragspartner für den Kauf ist und die
        Abrechnung samt anfallender Steuern übernimmt. Sobald das
        freigeschaltet ist, wird der konkrete Anbieter hier und in den{" "}
        <a href="/agb">AGB</a> namentlich genannt. Für die Erstattung selbst
        bleibt der Weg derselbe: du schreibst mir, ich kümmere mich darum.
      </p>

      <h2>Deine gesetzlichen Rechte</h2>
      <p>
        Diese Richtlinie ist ein freiwilliges Versprechen und beschränkt keine
        Rechte, die dir ohnehin zustehen. Zwingende Verbraucherschutzvorschriften
        deines Wohnsitzstaates, etwa ein gesetzliches Widerrufsrecht innerhalb
        der EU oder des EWR, gelten unabhängig davon weiter.
      </p>

      <h2>Fragen vorab</h2>
      <p>
        Wenn du unsicher bist, ob Pro dir überhaupt etwas bringt, frag lieber
        vorher über die <a href="/kontakt">Kontaktseite</a>. Mir ist eine Frage
        vor dem Kauf lieber als eine Erstattung danach.
      </p>
    </LegalShell>
  );
}
