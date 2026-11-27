import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

// `intlTag`: die App gibt den Tag der aktiven Sprache mit (LOCALE_TAGS in
// shared/i18n/locales.ts). Ohne Angabe gilt de-CH.
export function formatDate(
  iso: string | Date,
  opts?: Intl.DateTimeFormatOptions,
  intlTag = "de-CH"
) {
  const d = typeof iso === "string" ? new Date(iso) : iso;
  return new Intl.DateTimeFormat(intlTag, {
    month: "short",
    day: "numeric",
    year: "numeric",
    ...opts,
  }).format(d);
}

// Intl.RelativeTimeFormat statt handgeschriebener deutscher Endungen: im
// Deutschen (de-CH, "short") liefert es exakt die bisherigen Texte ("vor 5
// Min.", "vor 2 Std.", "vor 1 Tag", "vor 3 Tagen"), und jede andere Sprache
// bekommt ihre eigene Grammatik gratis mit. Nur "gerade eben" kommt vom
// Aufrufer, Intl hat dafür nur ein steifes "jetzt".
export function relativeTime(iso: string | Date, intlTag = "de-CH", justNow = "gerade eben") {
  const d = typeof iso === "string" ? new Date(iso) : iso;
  const diff = Math.floor((Date.now() - d.getTime()) / 1000);
  if (diff < 60) return justNow;
  const rtf = new Intl.RelativeTimeFormat(intlTag, { style: "short", numeric: "always" });
  if (diff < 3600) return rtf.format(-Math.floor(diff / 60), "minute");
  if (diff < 86400) return rtf.format(-Math.floor(diff / 3600), "hour");
  if (diff < 604800) return rtf.format(-Math.floor(diff / 86400), "day");
  return formatDate(d, undefined, intlTag);
}

export function downloadFile(filename: string, content: string, mime = "text/plain") {
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

/**
 * "900 B", "820 KB", "1,4 MB". `intlTag` ist der BCP-47-Tag der App-Sprache
 * (LOCALE_TAGS[locale].intl), damit das Dezimalzeichen zur Sprache passt. Ohne
 * Vorgabe: wer eine Grösse anzeigt, nennt die Sprache.
 */
export function formatBytes(bytes: number, intlTag: string): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  const mb = bytes / (1024 * 1024);
  return `${mb.toLocaleString(intlTag, { maximumFractionDigits: mb >= 10 ? 0 : 1 })} MB`;
}

/**
 * Eine UUID v4, echt oder selbst gebaut.
 *
 * `crypto.randomUUID()` verlangt einen Secure Context (https oder localhost).
 * Über blankes http auf eine LAN-IP, den üblichen Weg zum Testen am Handy,
 * fehlt es, und ein direkter Aufruf würfe beim Senden einer Nachricht und beim
 * Hochladen einer Datei. `crypto.getRandomValues()` gibt es überall, daraus baut
 * der Ersatz eine echte UUID v4 (RFC 4122 §4.4: Versionsbits 4, Variantenbits
 * 10xx). Die Form zählt: project-files.tsx schreibt den Wert in eine
 * `uuid primary key`-Spalte.
 */
export function randomId(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  const bytes = crypto.getRandomValues(new Uint8Array(16));
  bytes[6] = (bytes[6] & 0x0f) | 0x40;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;
  const hex = Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

/**
 * Baut `hsl(var(--x) / alpha)` aus dem Namen einer Design-Variable (globals.css
 * führt jede als nacktes Tripel „H S% L%“, etwa `--accent`).
 *
 * Komponenten übergeben den Variablennamen statt eines festen Farbwerts, damit
 * die Farbe mit dem Thema geht: im Dunkelmodus hat `--accent` einen anderen
 * Wert.
 */
export function hslVar(cssVar: string, alpha?: number): string {
  return alpha === undefined ? `hsl(var(${cssVar}))` : `hsl(var(${cssVar}) / ${alpha})`;
}
