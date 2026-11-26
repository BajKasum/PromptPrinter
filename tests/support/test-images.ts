import { readFileSync } from "node:fs";
import { join } from "node:path";
import { crc32 } from "node:zlib";

/**
 * Echte kleine Bilder für die Tests der Metadaten (src/features/chat/lib/image-metadata.ts), in
 * tests/support/images/. Erzeugt mit dem sharp, das Next mitbringt (libvips mit libexif, libpng und libwebp), also
 * nicht mit dem Code, den sie prüfen. Die Metadaten nennen ein Gerät (TestCam T-1000) und einen Aufnahmeort
 * (47° 22' 12.34" N, 8° 32' 56.78" E), als Exif und, wo angegeben, noch einmal als XMP:
 *
 *   plain.jpg, plain.png, plain.webp   16 × 12 Pixel, Farbverlauf, ohne Metadaten
 *   gps.jpg, gps.png, gps.webp         dieselben Pixel mit Exif und XMP (PNG: Exif als eXIf, XMP als zTXt)
 *   gps-rotated.jpg                    Exif mit Ort und Drehung 6 (um 90° im Uhrzeigersinn), dazu ein Farbprofil
 *   plain-progressive.jpg              40 × 30 Pixel Rauschen, progressiv (zehn Scans, maskierte 0xFF-Bytes)
 *   gps-progressive.jpg                dieselben Pixel mit Exif und XMP
 *   gps-animated.webp                  zwei Bilder als Animation, Exif mit Ort
 *
 * plain.jpg und gps.jpg (ebenso PNG und die beiden progressiven) unterscheiden sich nur in den Metadaten-Segmenten.
 */
export function testImage(name: string): Buffer<ArrayBuffer> {
  return readFileSync(join(process.cwd(), "tests/support/images", name));
}

/** Die Zeichenfolge, an der man Gerät und Ort in den Testbildern erkennt, als Text oder in Exif. */
export const METADATA_MARKERS = ["TestCam", "T-1000", "GPSLatitude"] as const;

export const ascii = (text: string) => Buffer.from(text, "latin1");

// ─── JPEG ─────────────────────────────────────────────────────────────────

export type JpegSegment = { marker: number; payload: Buffer };

/** Die Segmente vor dem ersten Scan (ohne SOI), so wie sie in der Datei stehen. */
export function jpegSegments(bytes: Buffer): JpegSegment[] {
  const out: JpegSegment[] = [];
  for (let p = 2; p + 4 <= bytes.length && bytes[p] === 0xff; ) {
    const marker = bytes[p + 1];
    const length = bytes.readUInt16BE(p + 2);
    out.push({ marker, payload: bytes.subarray(p + 4, p + 2 + length) });
    if (marker === 0xda) break;
    p += 2 + length;
  }
  return out;
}

/** Alles ab dem ersten Scan: die kodierten Bilddaten samt allem, was zwischen weiteren Scans steht, bis zum Ende. */
export function fromFirstScan(bytes: Buffer): Buffer {
  let p = 2;
  while (bytes[p + 1] !== 0xda) p += 2 + bytes.readUInt16BE(p + 2);
  return bytes.subarray(p);
}

/** Ein Segment, wie es in der Datei steht: 0xFF, Marker, Länge, Inhalt. */
export function jpegSegment(marker: number, payload: Buffer): Buffer {
  const head = Buffer.from([0xff, marker, 0, 0]);
  head.writeUInt16BE(payload.length + 2, 2);
  return Buffer.concat([head, payload]);
}

/** Dieselbe Datei mit weiteren Segmenten direkt nach SOI. */
export function withJpegSegments(jpeg: Buffer, ...segments: Buffer[]): Buffer {
  return Buffer.concat([jpeg.subarray(0, 2), ...segments, jpeg.subarray(2)]);
}

/** Ein Exif-Segment mit genau einem Eintrag im ersten IFD: der Drehung, in der angegebenen Byte-Reihenfolge. */
export function exifWithOrientation(value: number, order: "II" | "MM", type = 3): Buffer {
  const tiff = Buffer.alloc(8 + 2 + 12 + 4);
  const little = order === "II";
  tiff.write(order, 0, "latin1");
  const u16 = (v: number, at: number) => (little ? tiff.writeUInt16LE(v, at) : tiff.writeUInt16BE(v, at));
  const u32 = (v: number, at: number) => (little ? tiff.writeUInt32LE(v, at) : tiff.writeUInt32BE(v, at));
  u16(42, 2);
  u32(8, 4);
  u16(1, 8);
  u16(0x0112, 10);
  u16(type, 12);
  u32(1, 14);
  u16(value, 18);
  return jpegSegment(0xe1, Buffer.concat([ascii("Exif\0\0"), tiff]));
}

/** Die Drehung, die ein Exif-Segment trägt, so gelesen, wie ein Betrachter sie liest; `null` ohne Eintrag. */
export function orientationOf(payload: Buffer): number | null {
  const tiff = payload.subarray(6);
  const little = tiff.toString("latin1", 0, 2) === "II";
  const u16 = (at: number) => (little ? tiff.readUInt16LE(at) : tiff.readUInt16BE(at));
  const ifd = little ? tiff.readUInt32LE(4) : tiff.readUInt32BE(4);
  for (let i = 0; i < u16(ifd); i++) {
    const entry = ifd + 2 + i * 12;
    if (u16(entry) === 0x0112) return u16(entry + 8);
  }
  return null;
}

// ─── PNG ──────────────────────────────────────────────────────────────────

/** Ein Chunk mit richtiger Prüfsumme. */
export function pngChunk(type: string, data: Buffer = Buffer.alloc(0)): Buffer {
  const head = Buffer.alloc(8);
  head.writeUInt32BE(data.length, 0);
  head.write(type, 4, "latin1");
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(Buffer.concat([head.subarray(4), data])) >>> 0, 0);
  return Buffer.concat([head, data, crc]);
}

/** Die Typen der Chunks, in Reihenfolge. */
export function pngChunkTypes(bytes: Buffer): string[] {
  const out: string[] = [];
  for (let p = 8; p + 12 <= bytes.length; ) {
    const type = bytes.toString("latin1", p + 4, p + 8);
    out.push(type);
    p += 12 + bytes.readUInt32BE(p);
    if (type === "IEND") break;
  }
  return out;
}

/** Dieselbe Datei mit weiteren Chunks direkt nach IHDR. */
export function withPngChunks(png: Buffer, ...chunks: Buffer[]): Buffer {
  const afterIhdr = 8 + 12 + png.readUInt32BE(8);
  return Buffer.concat([png.subarray(0, afterIhdr), ...chunks, png.subarray(afterIhdr)]);
}

/** Ein gültiges PNG von genau `size` Bytes: plain.png mit einem privaten Füll-Chunk, den das Entfernen wegnimmt. */
export function pngOfSize(size: number): Buffer {
  const plain = testImage("plain.png");
  const filler = size - plain.length - 12;
  if (filler < 0) throw new Error(`Ein PNG hat mindestens ${plain.length + 12} Bytes`);
  return withPngChunks(plain, pngChunk("prVt", Buffer.alloc(filler, 1)));
}

// ─── WebP ─────────────────────────────────────────────────────────────────

export type RiffChunk = { type: string; data: Buffer };

/** Die Chunks im RIFF-Container, ohne Auffüllbytes. */
export function webpChunks(bytes: Buffer): RiffChunk[] {
  const out: RiffChunk[] = [];
  const end = 8 + bytes.readUInt32LE(4);
  for (let p = 12; p + 8 <= end; ) {
    const size = bytes.readUInt32LE(p + 4);
    out.push({ type: bytes.toString("latin1", p, p + 4), data: bytes.subarray(p + 8, p + 8 + size) });
    p += 8 + size + (size % 2);
  }
  return out;
}

/** Ein Chunk samt Auffüllbyte bei ungerader Länge. */
export function riffChunk(type: string, data: Buffer): Buffer {
  const head = Buffer.alloc(8);
  head.write(type, 0, "latin1");
  head.writeUInt32LE(data.length, 4);
  return Buffer.concat([head, data, Buffer.alloc(data.length % 2)]);
}

/** Ein WebP-Container aus diesen Chunks, mit richtiger RIFF-Größe. */
export function webpOf(...chunks: Buffer[]): Buffer {
  const body = Buffer.concat(chunks);
  const head = Buffer.alloc(12);
  head.write("RIFF", 0, "latin1");
  head.writeUInt32LE(4 + body.length, 4);
  head.write("WEBP", 8, "latin1");
  return Buffer.concat([head, body]);
}
