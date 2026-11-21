// Was vor dem Hydrieren in einem Feld stand, gehört danach in den State des Formulars.
//
// Die Anmeldeseiten und die beiden Seiten zum Passwort-Zurücksetzen kommen mit fertigem Formular vom Server, React
// hydriert erst danach, auf langsamem Netz Sekunden später. Was dazwischen getippt oder vom Browser oder
// Passwort-Manager eingefüllt wurde, steht nur im Feld: React lässt den Wert beim Hydrieren stehen, löst dafür aber
// kein onChange aus (erst react-dom-experimental tut das), der State bleibt leer. Ohne diesen Schritt meldet das Formular "Bitte eine gültige Email eingeben" neben einer sichtbar
// eingetragenen Adresse, und beim nächsten Rendern setzt React das Feld auf den leeren State zurück. Die Formulare
// rufen diese Funktionen deshalb einmal nach dem Einhängen auf; danach meldet onChange jede Änderung selbst.

/** Gibt einen nicht leeren Wert des Feldes an `adopt` weiter. */
export function adoptPrefilledValue(input: HTMLInputElement | null, adopt: (value: string) => void): void {
  if (input && input.value !== "") adopt(input.value);
}

/** Gibt ein gesetztes Häkchen an `adopt` weiter. */
export function adoptPrefilledCheck(input: HTMLInputElement | null, adopt: (checked: true) => void): void {
  if (input?.checked) adopt(true);
}
