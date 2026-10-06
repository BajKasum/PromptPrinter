// Was Vercel Speed Insights von einem Seitenaufruf mitbekommt, bevor es
// gesendet wird (`beforeSend` im Paket).
//
// Das Messskript schickt die vollständige Adresse der Seite (`location.href`).
// Bei uns steckt darin mehr, als in einen Mess-Speicher gehört:
//
// - Chats und Projekte tragen ihre Kennung im Pfad (`/chats/<uuid>`,
//   `/projects/<uuid>/chats/<uuid>`). Für eine Ladezeit ist es gleichgültig,
//   welcher Chat es war, und eine Kennung, die zu einem Konto gehört, hat in
//   einer Messreihe nichts verloren.
// - Hinter dem Fragezeichen können Einmalwerte stehen (Anmelde- und
//   Bestätigungslinks hängen `code` oder `token_hash` an), hinter dem Doppelkreuz
//   Fragmente. Beides ist für eine Ladezeit ohne Wert.
//
// Übrig bleibt der Pfad mit `[id]` an Stelle jeder UUID. Das Seitenmuster
// (`route`, z. B. `/chats/[id]`) bleibt unberührt, es stammt aus dem Paket und
// enthält schon keine Kennung. Was sich nicht als Adresse lesen lässt, wird
// nicht gesendet: lieber ein Messwert weniger als einer, den wir nicht
// geprüft haben.

const UUID = /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi;

// Vor dem Parsen muss etwas stehen, das eine relative Adresse auflöst. Der Wert
// kommt nie in die Ausgabe, nur der Pfad.
const RESOLVE_BASE = "http://localhost";
const ABSOLUTE_URL = /^[a-z][a-z0-9+.-]*:/i;

export function scrubSpeedInsightsEvent<T extends { url: string }>(event: T): T | null {
  let parsed: URL;
  try {
    parsed = new URL(event.url, RESOLVE_BASE);
  } catch {
    return null;
  }

  const path = parsed.pathname.replace(UUID, "[id]");
  // Form der Eingabe beibehalten: Mit Ursprung rein, mit Ursprung raus, relativ
  // rein, relativ raus.
  const url = ABSOLUTE_URL.test(event.url) ? `${parsed.origin}${path}` : path;
  return { ...event, url };
}
