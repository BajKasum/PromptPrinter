import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

// `intlTag` seit der Sprachwahl (29.09.2026): die App gibt den Tag der
// aktiven Sprache mit (LOCALE_TAGS in shared/i18n/locales.ts). Ohne Angabe
// bleibt es de-CH, wie vorher.
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

export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  const kb = bytes / 1024;
  return `${kb.toFixed(kb < 10 ? 1 : 0)} KB`;
}

/**
 * A UUID v4, real or fallback (QA finding K-4).
 *
 * `crypto.randomUUID()` requires a Secure Context — https, or localhost. Over
 * plain http on a LAN IP (the standard way to test on a real phone during
 * dev) it's `undefined`, and every call site that used it directly threw the
 * moment it ran: the chat composer on send, the file upload on pick. Neither
 * failure mode is obvious from the resulting error.
 *
 * `crypto.getRandomValues()` has no such restriction — it's available in
 * every context — so the fallback builds a real v4 UUID from it by hand
 * (RFC 4122 §4.4: version nibble forced to 4, variant bits forced to 10xx)
 * rather than returning some other random-string shape. That matters here:
 * project-files.tsx inserts this value into a `uuid primary key` column, so
 * "unique enough" isn't sufficient, it has to parse as one.
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
 * Builds an `hsl(var(--x) / alpha)` string from a design-token CSS variable
 * name (globals.css defines each as a bare "H S% L%" triplet, this file's own
 * convention — see e.g. `--accent`).
 *
 * QA finding C-3: a few components (settings-workspace.tsx, tool-picker.tsx)
 * used to build their "soft glow" accent colors by string-concatenating a
 * hex alpha suffix onto a *hardcoded* hex color (`` `${accent}33` ``). That
 * meant a literal, always-light-mode value ("#8FCDF2") had to be passed in
 * and baked into the component's own props — a real theme bug, not just a
 * lint violation: the Dark-Mode `--accent` is a different value
 * (`204 80% 75%`), so the settings page showed the wrong accent whenever the
 * user was in dark mode. `hslVar` takes the *token name* instead, so the
 * value itself stays theme-aware.
 */
export function hslVar(cssVar: string, alpha?: number): string {
  return alpha === undefined ? `hsl(var(${cssVar}))` : `hsl(var(${cssVar}) / ${alpha})`;
}

export function slugify(input: string) {
  return input
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
}
