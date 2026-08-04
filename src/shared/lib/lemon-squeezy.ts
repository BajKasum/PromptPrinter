// Checkout-Adressen für Lemon Squeezy, den Zahlungsanbieter (Merchant of
// Record, siehe pricing.ts' Margenrechnung).
//
// Reine Funktionen, absichtlich ohne React: die Adresse wird an zwei sehr
// verschiedenen Orten gebaut — auf der öffentlichen Preisseite ohne jede
// Kenntnis des Besuchers, und auf der Abrechnungsseite mit Konto und Mail —
// und beide Wege sollen dieselbe Prüfung durchlaufen. Die Komponente
// (shared/ui/lemon-checkout-button.tsx) benutzt das hier, sie ersetzt es nicht.

/**
 * Hosts, deren Checkout wir öffnen.
 *
 * Diese Liste ist kein Selbstzweck: sie muss mit `frame-src` in
 * server/security/csp.ts übereinstimmen. Steht in der Umgebungsvariablen eine
 * Adresse, die hier durchfällt, wäre sie im Browser ohnehin von der CSP
 * blockiert worden — dann lieber hier sichtbar scheitern (Button fällt auf
 * seinen `fallbackHref` zurück, env.ts warnt beim Start) als im Browser
 * stumm. Wer später eine eigene Checkout-Domain in Lemon Squeezy einrichtet,
 * muss BEIDE Stellen anfassen.
 */
const CHECKOUT_HOST_SUFFIX = ".lemonsqueezy.com";

/**
 * Prüft die konfigurierte Checkout-Adresse und gibt sie normalisiert zurück,
 * oder `null`, wenn sie fehlt oder nicht benutzbar ist.
 *
 * `null` ist ein erwarteter Zustand, kein Fehler: eine Vorschau-Deployment
 * oder ein frisch geklontes Repo hat die Variable nicht, und die App muss
 * trotzdem laufen (die Preisseite zeigt dann ihren bisherigen Registrierungs-
 * Link). Deshalb wirft hier nichts, auch nicht bei Unsinn im Wert.
 */
export function normalizeCheckoutUrl(raw: string | undefined | null): string | null {
  const trimmed = raw?.trim();
  if (!trimmed) return null;

  let url: URL;
  try {
    url = new URL(trimmed);
  } catch {
    return null;
  }

  // https erzwungen, nicht nur empfohlen: über diese Adresse laufen
  // Zahlungsdaten, und die CSP setzt ohnehin `upgrade-insecure-requests`.
  if (url.protocol !== "https:") return null;

  const host = url.hostname.toLowerCase();
  if (host !== "lemonsqueezy.com" && !host.endsWith(CHECKOUT_HOST_SUFFIX)) return null;

  return url.toString();
}

/** Die konfigurierte Checkout-Adresse, oder `null`. */
export function checkoutUrlFromEnv(): string | null {
  // Direkter Zugriff auf die Property, nicht über eine Variable: Next ersetzt
  // `process.env.NEXT_PUBLIC_*` im Client-Bundle textuell, ein dynamischer
  // Zugriff bliebe im Browser undefined.
  return normalizeCheckoutUrl(process.env.NEXT_PUBLIC_LEMONSQUEEZY_CHECKOUT_URL);
}

export type CheckoutOptions = {
  /** Mail des angemeldeten Käufers, spart ihm eine Eingabe. */
  email?: string | null;
  /**
   * Konto-ID des Käufers, wandert als `custom_data` durch die Bestellung.
   *
   * Heute der einzige Weg, eine eingegangene Zahlung ohne Rückfrage dem
   * richtigen Konto zuzuordnen — im Lemon-Squeezy-Dashboard steht sie an der
   * Bestellung. Sobald ein Webhook dazukommt, kommt derselbe Wert dort
   * signiert wieder an, und die Freischaltung wird ein Datenbank-Update.
   *
   * Sie ist vom Browser aus manipulierbar. Das ist hier folgenlos: wer sie
   * fälscht, bezahlt ein fremdes Konto frei, schadet also nur sich selbst.
   * Ein Webhook darf daraus trotzdem kein Vertrauen ableiten, sondern muss
   * die Zahlung selbst als Wahrheit nehmen (Signaturprüfung) und diese ID
   * nur als Zuordnung behandeln.
   */
  userId?: string | null;
  /** Overlay und Checkout im dunklen Look ausliefern. */
  dark?: boolean;
};

/**
 * Baut die endgültige Checkout-Adresse.
 *
 * `embed=1` steht bewusst drin, obwohl Lemon.js es beim Öffnen selbst setzt
 * (`Url.Build`): dieselbe Adresse ist auch das `href` des Links, und wenn ein
 * Besucher ohne Lemon.js dort landet — Skript noch nicht geladen, JavaScript
 * aus —, soll er die schlanke Checkout-Seite bekommen und nicht die
 * Store-Variante mit Kopfzeile.
 */
export function buildCheckoutUrl(
  base: string | null,
  { email, userId, dark }: CheckoutOptions = {}
): string | null {
  if (!base) return null;

  const url = new URL(base);
  url.searchParams.set("embed", "1");
  if (email) url.searchParams.set("checkout[email]", email);
  if (userId) url.searchParams.set("checkout[custom][user_id]", userId);
  if (dark) url.searchParams.set("dark", "1");

  return url.toString();
}
