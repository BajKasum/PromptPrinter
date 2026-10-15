// Ziffer 4 der Datenschutzerklaerung, Teil 2: die Empfaenger, die nicht in unserem
// Auftrag handeln oder vom Nutzer selbst gewaehlt werden (Browser-Spracherkennung,
// Google- und GitHub-Anmeldung, eigener API-Schluessel), samt dem Satz zu Werbung und
// Training. Aus der Seite ausgelagert, damit sie unter der Dateigrenze von 400 Zeilen
// bleibt (tests/guards/file-size.test.ts). Der Text ist unveraendert.
export function DatenschutzWeitereEmpfaenger() {
  return (
    <>
      <p>
        <strong>Spracherkennung im Sprachmodus (Ziffer 2):</strong> Nutzt du die Diktierfunktion
        im Chat, bearbeitet nicht wir deine Sprachaufnahme, sondern dein <strong>Browser</strong>,
        über eine in ihm eingebaute Funktion (die „Web Speech API“), auf deren Anbieter und
        Umsetzung wir keinen Einfluss haben und für die wir keinen eigenen Vertrag geschlossen
        haben. Je nachdem, welchen Browser du verwendest, geht die Aufnahme dabei an:
      </p>
      <ul>
        <li>
          <strong>Google Chrome</strong>: an <strong>Google</strong> (Google Ireland Ltd. / Google
          LLC, USA);
        </li>
        <li>
          <strong>Microsoft Edge</strong>: an <strong>Microsoft</strong> (Microsoft Ireland
          Operations Ltd. / Microsoft Corporation, USA);
        </li>
        <li>
          <strong>Safari</strong>: nach Angaben von Apple für unterstützte Sprachen direkt auf
          deinem Gerät, ohne Übermittlung an einen Server;
        </li>
        <li>andere oder ältere Browser: je nach deren eigener Umsetzung, teils ganz ohne diese Funktion.</li>
      </ul>
      <p>
        Diese Übermittlung findet unmittelbar zwischen deinem Browser und dem jeweiligen Anbieter
        statt; deine Sprachaufnahme durchläuft unsere Server zu keinem Zeitpunkt und wird von uns
        nicht gespeichert. Weil wir diese Bearbeitung nicht steuern und keine
        Auftragsbearbeitungsvereinbarung mit Google oder Microsoft für diesen Zweck getroffen
        haben, handelt es sich dabei nicht um eine Auftragsbearbeitung in unserem Sinn, sondern um
        eine Bearbeitung durch den Anbieter deines Browsers in eigener Verantwortung; es gelten
        dessen eigene Datenschutzbestimmungen. Wenn du das vermeiden möchtest, nutze den Chat über
        die Tastatur statt über den Sprachmodus, oder einen Browser mit lokaler Spracherkennung
        wie Safari.
      </p>
      <p>
        <strong>Anmeldung über Google oder GitHub (Ziffer 2):</strong> Wählst du diesen Weg, meldest
        du dich direkt bei <strong>Google</strong> (Google Ireland Ltd. / Google LLC, USA) bzw.{" "}
        <strong>GitHub</strong> (GitHub, Inc., USA) an, die uns danach die in Ziffer 2 genannten
        Angaben übermitteln. Diese Anbieter handeln dabei in eigener Verantwortung, es gelten deren
        Datenschutzbestimmungen. Für das Projekt-Gedächtnis ruft unser Server ausserdem öffentliche
        Daten bei GitHub ab, ohne dabei Angaben über dich zu übermitteln.
      </p>
      <p>
        <strong>Wenn du einen eigenen API-Schlüssel hinterlegst</strong>, gehen deine Eingaben nicht
        mehr an die oben genannten Modellanbieter, sondern an den von dir gewählten Anbieter, je
        nach deiner Auswahl etwa <strong>Anthropic</strong> (Anthropic PBC, USA),{" "}
        <strong>OpenAI</strong> (OpenAI, L.L.C., USA), <strong>Google</strong> oder einen von dir
        selbst eingetragenen, kompatiblen Endpunkt. In diesem Fall bestimmst du den Empfänger, und
        es gelten zusätzlich dessen Datenschutzbestimmungen. Auf die Bearbeitung durch diesen
        Anbieter haben wir keinen Einfluss.
      </p>
      <p>
        Wir geben deine Daten nicht zu Werbezwecken weiter und verkaufen sie nicht. Wir werten deine
        Inhalte nicht aus, um damit KI-Modelle zu trainieren.
      </p>
    </>
  );
}
