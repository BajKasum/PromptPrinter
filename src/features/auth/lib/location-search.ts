import { safeNextPath } from "@/shared/lib/site-url";

// Anmelden, Registrieren und der zweite Faktor sind statisch vorgerendert und kommen mit fertigem Formular vom CDN.
// Der Server kennt die Query dabei nicht: mit `useSearchParams` rendert Next die Seite ohne Formular vor (im HTML
// stünde nur der Titel, auf langsamem 4G käme das Formular erst nach rund 5 s). Deshalb lesen diese Seiten
// `next` und `error` erst im Browser, aus `window.location`, und nur in Handlern und Effekten, nie beim Rendern: so
// rendern Server und Browser dasselbe, und es gibt keinen Unterschied beim Hydrieren.

/** Ein Wert aus der Query der aktuellen Adresse. Nur im Browser aufrufen, in Handlern und Effekten. */
export function locationSearchParam(name: string): string | null {
  return new URLSearchParams(window.location.search).get(name);
}

/** Wohin es nach der Anmeldung geht (`?next=`), geprüft durch `safeNextPath`, sonst der Chat. */
export function nextPathFromLocation(): string {
  return safeNextPath(locationSearchParam("next"));
}
