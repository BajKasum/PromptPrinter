import type { ImageMediaType } from "@/shared/lib/chat-attachments";

// Fotos ohne Metadaten. Was eine Kamera oder ein Bildprogramm über das Bild hinaus in die Datei schreibt (Exif mit
// Aufnahmeort, Gerät und Zeitpunkt, XMP, IPTC, Kommentare, Content Credentials), braucht Finn nie. Es soll weder im
// Speicher liegen noch an den Modellanbieter gehen. Der Browser nimmt es vor dem Hochladen heraus
// (prepare-attachment.ts), der Server noch einmal, bevor er speichert (attachment-validation.ts): er traut dem Browser
// nicht, und ein Tab mit älterem Code schickt noch die Originale.
//
// Herausgenommen werden ganze Segmente und Chunks, die Bilddaten bleiben Byte für Byte erhalten. Kein neues Kodieren
// also: kein Qualitätsverlust, die Datei wird nur kleiner, ein animiertes PNG oder WebP bleibt animiert. Was bleibt,
// steht in einer Positivliste und gehört zum Anzeigen (Farbprofil, Transparenz, Animation, Pixeldichte); Unbekanntes
// fällt weg, ebenso alles hinter dem Ende des Bildes (das Video eines Bewegungsfotos, angehängte weitere Bilder). Aus
// Exif bleibt bei JPEG allein die Drehung: ein Handy speichert ein Hochkantfoto quer und schreibt die Drehung dazu,
// ohne sie läge das Bild auf der Seite. PNG und WebP tragen sie praktisch nie, dort fällt Exif ganz weg.
//
// Lässt sich eine Datei nicht vollständig zerlegen, ist das Ergebnis `null`: der Browser kodiert sie dann über das
// Canvas neu, was ohnehin nur die Pixel übrig lässt, und der Server nimmt sie nicht an.

export type CleanImage = { mediaType: ImageMediaType; bytes: Uint8Array<ArrayBuffer> };

const ascii = (text: string) => Array.from(text, (char) => char.charCodeAt(0));

const PNG_SIGNATURE = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];
const RIFF = ascii("RIFF");
const WEBP = ascii("WEBP");

function startsWith(bytes: Uint8Array, prefix: readonly number[], at = 0): boolean {
  return bytes.length >= at + prefix.length && prefix.every((byte, i) => bytes[at + i] === byte);
}

const view = (bytes: Uint8Array) => new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
const fourcc = (bytes: Uint8Array, at: number) => String.fromCharCode(...bytes.subarray(at, at + 4));

function concat(parts: readonly Uint8Array[]): Uint8Array<ArrayBuffer> {
  const out = new Uint8Array(parts.reduce((sum, part) => sum + part.length, 0));
  let at = 0;
  for (const part of parts) {
    out.set(part, at);
    at += part.length;
  }
  return out;
}

/**
 * Welches Bild ist das, den Bytes nach?
 *
 * Der Typ, den der Browser angibt, zählt nicht: er geht an den KI-Anbieter und bestimmt, mit welchem Content-Type das
 * Objekt ausgeliefert wird. Eine Datei, die sich als PNG ausgibt und keines ist, wird abgelehnt statt weitergereicht.
 */
export function sniffImageType(bytes: Uint8Array): ImageMediaType | null {
  if (startsWith(bytes, PNG_SIGNATURE)) return "image/png";
  if (startsWith(bytes, [0xff, 0xd8, 0xff])) return "image/jpeg";
  if (startsWith(bytes, RIFF) && startsWith(bytes, WEBP, 8)) return "image/webp";
  return null;
}

/** Das Bild ohne Metadaten, als neue Bytes. `null`, wenn es kein vollständig lesbares PNG, JPEG oder WebP ist. */
export function stripImageMetadata(bytes: Uint8Array): CleanImage | null {
  const mediaType = sniffImageType(bytes);
  if (!mediaType) return null;
  const clean =
    mediaType === "image/jpeg" ? stripJpeg(bytes) : mediaType === "image/png" ? stripPng(bytes) : stripWebp(bytes);
  return clean ? { mediaType, bytes: clean } : null;
}

// ─── JPEG ─────────────────────────────────────────────────────────────────
// Segmente (0xFF, Marker, Länge, Inhalt) bis zum ersten Scan (SOS), dahinter die kodierten Bilddaten bis zum nächsten
// Marker. Bei progressiven Bildern wechseln sich weitere Segmente und Scans ab, das Bild endet mit EOI.

const EOI = 0xd9;
const SOS = 0xda;
const TEM = 0x01;
const APP0 = 0xe0;
const APP1 = 0xe1;
const APP2 = 0xe2;
const APP14 = 0xee;
const APP15 = 0xef;
const COM = 0xfe;
const EXIF_HEADER = [...ascii("Exif"), 0, 0];
const ICC_PROFILE = [...ascii("ICC_PROFILE"), 0];
const ADOBE = ascii("Adobe");
const ORIENTATION_TAG = 0x0112;

const isRestart = (marker: number) => marker >= 0xd0 && marker <= 0xd7;

/** Alles bleibt, was kein Anwendungssegment und kein Kommentar ist, dazu drei Anwendungssegmente fürs Anzeigen. */
function keepsJpegSegment(marker: number, payload: Uint8Array): boolean {
  if (marker === COM) return false;
  if (marker < APP0 || marker > APP15) return true;
  if (marker === APP0) return true; // JFIF: Pixeldichte, höchstens ein Vorschaubild desselben Bildes
  if (marker === APP2) return startsWith(payload, ICC_PROFILE); // das Farbprofil, nicht MPF mit weiteren Bildern
  if (marker === APP14) return startsWith(payload, ADOBE); // wie die Farben kodiert sind (RGB, CMYK)
  return false;
}

/** Wo die kodierten Bilddaten ab `from` enden: am nächsten Marker, der nicht zu ihnen gehört. -1, wenn keiner folgt. */
function scanEnd(bytes: Uint8Array, from: number): number {
  for (let p = from; p + 1 < bytes.length; p++) {
    if (bytes[p] !== 0xff) continue;
    const next = bytes[p + 1];
    // 0xFF 0x00 ist ein maskiertes Datenbyte, RST0 bis RST7 gehören zu den Daten, 0xFF 0xFF füllt vor einem Marker.
    if (next === 0x00 || next === 0xff || isRestart(next)) continue;
    return p;
  }
  return -1;
}

/** Die Drehung aus Exif (Tag 0x0112 im ersten IFD), `null`, wenn keine lesbar dasteht. */
function exifOrientation(payload: Uint8Array): number | null {
  if (!startsWith(payload, EXIF_HEADER)) return null;
  const tiff = payload.subarray(EXIF_HEADER.length);
  if (tiff.length < 8) return null;
  const little = tiff[0] === 0x49 && tiff[1] === 0x49;
  if (!little && !(tiff[0] === 0x4d && tiff[1] === 0x4d)) return null;
  const data = view(tiff);
  if (data.getUint16(2, little) !== 42) return null;
  const ifd = data.getUint32(4, little);
  if (ifd + 2 > tiff.length) return null;
  const count = data.getUint16(ifd, little);
  for (let i = 0; i < count; i++) {
    const entry = ifd + 2 + i * 12;
    if (entry + 12 > tiff.length) return null;
    if (data.getUint16(entry, little) !== ORIENTATION_TAG) continue;
    const value = data.getUint16(entry + 8, little);
    return data.getUint16(entry + 2, little) === 3 && value >= 1 && value <= 8 ? value : null;
  }
  return null;
}

/** Ein Exif-Segment, das nur die Drehung trägt: TIFF in Big Endian, ein IFD mit einem Eintrag (SHORT, ein Wert). */
function orientationSegment(orientation: number): Uint8Array {
  return Uint8Array.of(
    0xff, APP1, 0x00, 0x22, // Marker, Länge 34
    ...EXIF_HEADER,
    0x4d, 0x4d, 0x00, 0x2a, 0x00, 0x00, 0x00, 0x08, // "MM", 42, erstes IFD ab Byte 8
    0x00, 0x01, // ein Eintrag
    0x01, 0x12, 0x00, 0x03, 0x00, 0x00, 0x00, 0x01, 0x00, orientation, 0x00, 0x00,
    0x00, 0x00, 0x00, 0x00 // kein weiteres IFD
  );
}

function stripJpeg(bytes: Uint8Array): Uint8Array<ArrayBuffer> | null {
  const parts: Uint8Array[] = [bytes.subarray(0, 2)];
  let orientation: { value: number; at: number } | null = null;
  let scanned = false;
  for (let p = 2; ; ) {
    if (bytes[p] !== 0xff) return null;
    while (bytes[p + 1] === 0xff) p++; // Füllbytes vor dem Marker
    const marker = bytes[p + 1];
    if (marker === undefined) return null;
    if (marker === EOI) {
      if (!scanned) return null;
      parts.push(bytes.subarray(p, p + 2));
      break; // Was danach kommt, gehört nicht zum Bild.
    }
    if (marker === TEM) {
      parts.push(bytes.subarray(p, p + 2));
      p += 2;
      continue;
    }
    if (marker === 0x00 || marker === 0xd8 || isRestart(marker) || p + 4 > bytes.length) return null;
    const length = (bytes[p + 2] << 8) | bytes[p + 3];
    const end = p + 2 + length;
    if (length < 2 || end > bytes.length) return null;
    const payload = bytes.subarray(p + 4, end);
    if (marker === SOS) {
      const dataEnd = scanEnd(bytes, end);
      if (dataEnd < 0) return null;
      parts.push(bytes.subarray(p, dataEnd));
      scanned = true;
      p = dataEnd;
      continue;
    }
    if (keepsJpegSegment(marker, payload)) {
      parts.push(bytes.subarray(p, end));
    } else if (marker === APP1 && !orientation) {
      const value = exifOrientation(payload);
      if (value !== null) orientation = { value, at: parts.length };
    }
    p = end;
  }
  // Die Drehung kommt an die Stelle des alten Exif-Segments; 1 heisst "aufrecht" und braucht keins.
  if (orientation && orientation.value !== 1) parts.splice(orientation.at, 0, orientationSegment(orientation.value));
  return concat(parts);
}

// ─── PNG ──────────────────────────────────────────────────────────────────
// Nach der Signatur Chunks: Länge, Typ, Inhalt, Prüfsumme. Ein Großbuchstabe vorn heisst kritisch, ohne den Chunk
// lässt sich das Bild nicht lesen. Von den übrigen bleiben die, die zum Anzeigen gehören; Text (tEXt, zTXt, iTXt,
// darin auch XMP), eXIf, tIME und Unbekanntes fallen weg.

const PNG_KEPT_ANCILLARY = new Set([
  "tRNS", // Transparenz
  "gAMA", "cHRM", "sRGB", "iCCP", "cICP", "mDCV", "cLLI", "sBIT", // Farbe
  "bKGD", "hIST", "sPLT", "pHYs", // Hintergrund, Palette, Pixeldichte
  "acTL", "fcTL", "fdAT", // Animation (APNG)
]);

function stripPng(bytes: Uint8Array): Uint8Array<ArrayBuffer> | null {
  const data = view(bytes);
  const parts: Uint8Array[] = [bytes.subarray(0, PNG_SIGNATURE.length)];
  for (let p = PNG_SIGNATURE.length; p + 12 <= bytes.length; ) {
    const type = fourcc(bytes, p + 4);
    const end = p + 12 + data.getUint32(p);
    if (!/^[A-Za-z]{4}$/.test(type) || end > bytes.length) return null;
    if (p === PNG_SIGNATURE.length && type !== "IHDR") return null;
    const critical = (bytes[p + 4] & 0x20) === 0;
    if (critical || PNG_KEPT_ANCILLARY.has(type)) parts.push(bytes.subarray(p, end));
    if (type === "IEND") return concat(parts); // Was danach kommt, gehört nicht zum Bild.
    p = end;
  }
  return null;
}

// ─── WebP ─────────────────────────────────────────────────────────────────
// Ein RIFF-Container: "RIFF", Größe, "WEBP", dann Chunks (Typ, Größe, Inhalt, auf gerade Länge aufgefüllt). Im
// erweiterten Format sagen zwei Bits im Kopf (VP8X), ob Exif und XMP folgen; sie gehen mit ihren Chunks.

const WEBP_KEPT = new Set(["VP8 ", "VP8L", "VP8X", "ALPH", "ANIM", "ANMF", "ICCP"]);
const VP8X_EXIF = 0x08;
const VP8X_XMP = 0x04;

function stripWebp(bytes: Uint8Array): Uint8Array<ArrayBuffer> | null {
  const data = view(bytes);
  const riffEnd = 8 + data.getUint32(4, true);
  if (riffEnd <= 12 || riffEnd > bytes.length) return null;
  const parts: Uint8Array[] = [];
  for (let p = 12; p < riffEnd; ) {
    if (p + 8 > riffEnd) return null;
    const type = fourcc(bytes, p);
    const size = data.getUint32(p + 4, true);
    const end = p + 8 + size;
    if (end > riffEnd) return null;
    if (p === 12 && type !== "VP8 " && type !== "VP8L" && type !== "VP8X") return null;
    if (WEBP_KEPT.has(type)) {
      if (type === "VP8X") {
        if (size < 10) return null;
        // Eine Kopie: Buffer.slice teilt den Speicher, die Eingabe bliebe sonst nicht, wie sie war.
        const header = new Uint8Array(bytes.subarray(p, end));
        header[8] &= ~(VP8X_EXIF | VP8X_XMP);
        parts.push(header);
      } else {
        parts.push(bytes.subarray(p, end));
      }
      if (size % 2 === 1) parts.push(new Uint8Array(1));
    }
    p = end + (size % 2);
  }
  const body = concat(parts);
  const out = new Uint8Array(12 + body.length);
  out.set(bytes.subarray(0, 12));
  view(out).setUint32(4, 4 + body.length, true);
  out.set(body, 12);
  return out; // Was hinter dem RIFF-Container kommt, gehört nicht zum Bild.
}
