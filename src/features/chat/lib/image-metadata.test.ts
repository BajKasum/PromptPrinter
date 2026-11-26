import { describe, expect, it } from "vitest";
import { sniffImageType, stripImageMetadata } from "@/features/chat/lib/image-metadata";
import {
  METADATA_MARKERS,
  ascii,
  exifWithOrientation,
  fromFirstScan,
  jpegSegment,
  jpegSegments,
  orientationOf,
  pngChunk,
  pngChunkTypes,
  riffChunk,
  testImage,
  webpChunks,
  webpOf,
  withJpegSegments,
  withPngChunks,
} from "@tests/support/test-images";

// Die Bilder unter tests/support/images/ hat sharp erzeugt (libvips), nicht dieser Code: plain.* und gps.* tragen
// dieselben Pixel, gps.* dazu Gerät und Aufnahmeort. Dass die bereinigten Dateien sich dekodieren lassen und Pixel für
// Pixel gleich bleiben, ist mit sharp nachgeprüft; hier steht, was an Bytes übrig bleibt.

const APP1 = 0xe1;
const APP2 = 0xe2;
const APP14 = 0xee;

function stripped(bytes: Buffer): Buffer {
  const clean = stripImageMetadata(bytes);
  if (!clean) throw new Error("nicht zerlegbar");
  return Buffer.from(clean.bytes);
}

function expectNoMetadata(bytes: Buffer) {
  for (const marker of METADATA_MARKERS) expect(bytes.includes(marker), marker).toBe(false);
}

describe("sniffImageType", () => {
  it("erkennt die drei Formate an den ersten Bytes und sonst nichts", () => {
    expect(sniffImageType(testImage("plain.jpg"))).toBe("image/jpeg");
    expect(sniffImageType(testImage("plain.png"))).toBe("image/png");
    expect(sniffImageType(testImage("plain.webp"))).toBe("image/webp");
    expect(sniffImageType(ascii("GIF89a......"))).toBeNull();
  });
});

describe("stripImageMetadata: JPEG", () => {
  it("nimmt Exif und XMP mit Gerät und Aufnahmeort heraus, die Bilddaten bleiben Byte für Byte", () => {
    const gps = testImage("gps.jpg");
    expect(jpegSegments(gps).map((s) => s.marker)).toContain(APP1);
    for (const marker of METADATA_MARKERS) expect(gps.includes(marker), marker).toBe(true);

    const clean = stripped(gps);

    expectNoMetadata(clean);
    expect(jpegSegments(clean).map((s) => s.marker)).not.toContain(APP1);
    expect(clean.equals(testImage("plain.jpg"))).toBe(true);
  });

  it("lässt ein JPEG ohne Metadaten, wie es ist", () => {
    const plain = testImage("plain.jpg");
    expect(stripped(plain).equals(plain)).toBe(true);
    expect(stripImageMetadata(plain)?.mediaType).toBe("image/jpeg");
  });

  it("liest ein progressives JPEG über alle Scans bis zum Ende", () => {
    const clean = stripped(testImage("gps-progressive.jpg"));
    expectNoMetadata(clean);
    expect(clean.equals(testImage("plain-progressive.jpg"))).toBe(true);
  });

  it("behält aus Exif nur die Drehung, dazu das Farbprofil", () => {
    const rotated = testImage("gps-rotated.jpg");
    const clean = stripped(rotated);

    expectNoMetadata(clean);
    const app1 = jpegSegments(clean).filter((s) => s.marker === APP1);
    expect(app1).toHaveLength(1);
    expect(app1[0].payload.length).toBe(6 + 26); // "Exif\0\0", TIFF-Kopf, ein IFD mit einem Eintrag
    expect(orientationOf(app1[0].payload)).toBe(6);
    const icc = (bytes: Buffer) => jpegSegments(bytes).filter((s) => s.marker === APP2).map((s) => s.payload);
    expect(icc(clean)).toEqual(icc(rotated));
    expect(icc(clean)[0].subarray(0, 12).toString("latin1")).toBe("ICC_PROFILE\0");
    expect(fromFirstScan(clean).equals(fromFirstScan(rotated))).toBe(true);
  });

  it.each(["II", "MM"] as const)("liest die Drehung in beiden Byte-Reihenfolgen (%s)", (order) => {
    const clean = stripped(withJpegSegments(testImage("plain.jpg"), exifWithOrientation(8, order)));
    const app1 = jpegSegments(clean).filter((s) => s.marker === APP1);
    expect(app1.map((s) => orientationOf(s.payload))).toEqual([8]);
  });

  it("schreibt keine Drehung, wo keine nötig oder keine lesbar ist", () => {
    const plain = testImage("plain.jpg");
    for (const exif of [exifWithOrientation(1, "II"), exifWithOrientation(9, "MM"), exifWithOrientation(6, "II", 4)]) {
      expect(stripped(withJpegSegments(plain, exif)).equals(plain)).toBe(true);
    }
  });

  it("nimmt Kommentare, IPTC, Content Credentials und Mehrbild-Angaben heraus und behält, was zum Anzeigen gehört", () => {
    const plain = testImage("plain.jpg");
    const icc = jpegSegment(APP2, Buffer.concat([ascii("ICC_PROFILE\0"), Buffer.from([1, 1]), Buffer.alloc(20, 7)]));
    const adobe = jpegSegment(APP14, Buffer.concat([ascii("Adobe"), Buffer.alloc(7)]));
    const input = withJpegSegments(
      plain,
      jpegSegment(0xfe, ascii("Aufgenommen von Erika Muster")),
      jpegSegment(0xed, ascii("Photoshop 3.0\u00008BIM Zürich")),
      jpegSegment(0xeb, ascii("JP\u0000\u0000jumb c2pa")),
      jpegSegment(APP2, ascii("MPF\u0000II*\u0000")),
      icc,
      adobe,
      jpegSegment(0xe5, ascii("Hersteller"))
    );

    const clean = stripped(input);

    expect(clean.equals(withJpegSegments(plain, icc, adobe))).toBe(true);
  });

  it("schneidet ab, was hinter dem Ende des Bildes hängt (das Video eines Bewegungsfotos)", () => {
    const gps = testImage("gps.jpg");
    const motion = Buffer.concat([gps, ascii("\u0000\u0000\u0000\u0018ftypmp42"), Buffer.alloc(64, 3)]);
    expect(stripped(motion).equals(testImage("plain.jpg"))).toBe(true);
  });

  it("liest Neustart-Marker und Füllbytes in den Bilddaten als Teil der Daten", () => {
    const plain = testImage("plain.jpg");
    const end = plain.length - 2; // vor EOI
    const withRestart = Buffer.concat([plain.subarray(0, end), Buffer.from([0xff, 0xd3, 0x12, 0xff, 0xff]), plain.subarray(end)]);
    expect(stripped(withRestart).equals(withRestart)).toBe(true);
  });

  it("gibt null für alles, was sich nicht vollständig zerlegen lässt", () => {
    const plain = testImage("plain.jpg");
    const brokenLength = Buffer.from(plain);
    brokenLength.writeUInt16BE(0xfff0, 4); // das erste Segment reicht über das Ende hinaus
    const broken = [
      plain.subarray(0, plain.length - 2), // ohne EOI
      plain.subarray(0, 40), // mitten im Kopf abgeschnitten
      brokenLength,
      Buffer.concat([plain.subarray(0, 2), ascii("xx"), plain.subarray(2)]), // kein Marker nach SOI
      Buffer.from([0xff, 0xd8, 0xff, 0xd9]), // Ende ohne Bild
      Buffer.from([0xff, 0xd8, 0xff]),
    ];
    for (const bytes of broken) expect(stripImageMetadata(bytes)).toBeNull();
  });
});

describe("stripImageMetadata: PNG", () => {
  it("nimmt eXIf und XMP heraus, die Bilddaten bleiben Byte für Byte", () => {
    const gps = testImage("gps.png");
    expect(pngChunkTypes(gps)).toEqual(expect.arrayContaining(["eXIf", "zTXt"]));

    const clean = stripped(gps);

    expectNoMetadata(clean);
    expect(clean.equals(testImage("plain.png"))).toBe(true);
  });

  it("lässt ein PNG ohne Metadaten, wie es ist", () => {
    const plain = testImage("plain.png");
    expect(stripped(plain).equals(plain)).toBe(true);
  });

  it("behält Farbe, Transparenz und Animation und nimmt Text, Zeit und Unbekanntes heraus", () => {
    const plain = testImage("plain.png");
    const kept = [
      pngChunk("iCCP", Buffer.concat([ascii("sRGB\0\0"), Buffer.alloc(12, 5)])),
      pngChunk("tRNS", Buffer.from([0, 0])),
      pngChunk("acTL", Buffer.from([0, 0, 0, 1, 0, 0, 0, 0])),
      pngChunk("fcTL", Buffer.alloc(26)),
    ];
    const dropped = [
      pngChunk("tEXt", ascii("Author\0Erika Muster")),
      pngChunk("iTXt", ascii("XML:com.adobe.xmp\0\0\0\0\0<x:xmpmeta>GPSLatitude</x:xmpmeta>")),
      pngChunk("tIME", Buffer.from([0x07, 0xea, 11, 26, 12, 0, 0])),
      pngChunk("caBX", ascii("c2pa")),
      pngChunk("iDOT", Buffer.alloc(28)),
    ];

    const clean = stripped(withPngChunks(plain, ...dropped, ...kept));

    expect(clean.equals(withPngChunks(plain, ...kept))).toBe(true);
  });

  it("schneidet ab, was hinter IEND hängt", () => {
    const plain = testImage("plain.png");
    expect(stripped(Buffer.concat([plain, ascii("Anhang mit Ort")])).equals(plain)).toBe(true);
  });

  it("gibt null für alles, was sich nicht vollständig zerlegen lässt", () => {
    const plain = testImage("plain.png");
    const iend = plain.length - 12;
    const lyingLength = Buffer.from(plain);
    lyingLength.writeUInt32BE(0x7fffffff, 8); // IHDR behauptet eine Länge über das Ende hinaus
    const badType = Buffer.from(plain);
    badType.write("IH1R", 12, "latin1");
    const broken = [
      plain.subarray(0, iend), // ohne IEND
      lyingLength,
      badType,
      withPngChunks(plain, pngChunk("ab1c", Buffer.from([1]))), // ein Typ aus mehr als Buchstaben
      Buffer.concat([plain.subarray(0, 8), plain.subarray(8 + 12 + 13)]), // erster Chunk nicht IHDR
    ];
    for (const bytes of broken) expect(stripImageMetadata(bytes)).toBeNull();
  });
});

describe("stripImageMetadata: WebP", () => {
  it("nimmt Exif und XMP heraus, löscht ihre Bits im Kopf und rechnet die Größe neu", () => {
    const gps = testImage("gps.webp");
    expect(webpChunks(gps).map((c) => c.type)).toEqual(["VP8X", "VP8 ", "EXIF", "XMP "]);

    const clean = stripped(gps);

    expectNoMetadata(clean);
    const chunks = webpChunks(clean);
    expect(chunks.map((c) => c.type)).toEqual(["VP8X", "VP8 "]);
    expect(chunks[0].data[0] & 0x0c).toBe(0);
    expect(chunks[1].data.equals(webpChunks(testImage("plain.webp"))[0].data)).toBe(true);
    expect(clean.readUInt32LE(4)).toBe(clean.length - 8);
  });

  it("lässt ein WebP ohne Metadaten, wie es ist", () => {
    const plain = testImage("plain.webp");
    expect(stripped(plain).equals(plain)).toBe(true);
  });

  it("lässt eine Animation animiert", () => {
    const animated = testImage("gps-animated.webp");
    const clean = stripped(animated);

    expectNoMetadata(clean);
    const types = webpChunks(clean).map((c) => c.type);
    expect(types).toEqual(["VP8X", "ANIM", "ANMF", "ANMF"]);
    const flags = webpChunks(clean)[0].data[0];
    expect(flags & 0x02).toBe(0x02); // Animation
    expect(flags & 0x08).toBe(0); // Exif
  });

  it("hält Chunks ungerader Länge aufgefüllt und schneidet ab, was hinter dem Container hängt", () => {
    const plainVp8 = webpChunks(testImage("plain.webp"))[0].data;
    const vp8x = Buffer.from([0x2c, 0, 0, 0, 15, 0, 0, 11, 0, 0]); // Farbprofil, Exif, XMP; 16 × 12
    const profile = Buffer.from([1, 2, 3, 4, 5]);
    const input = Buffer.concat([
      webpOf(
        riffChunk("VP8X", vp8x),
        riffChunk("ICCP", profile),
        riffChunk("VP8 ", plainVp8),
        riffChunk("EXIF", ascii("TestCam"))
      ),
      ascii("Anhang"),
    ]);

    const clean = stripped(input);

    const chunks = webpChunks(clean);
    expect(chunks.map((c) => c.type)).toEqual(["VP8X", "ICCP", "VP8 "]);
    expect(chunks[0].data[0]).toBe(0x20);
    expect(chunks[1].data.equals(profile)).toBe(true);
    expect(chunks[2].data.equals(plainVp8)).toBe(true);
    expect(clean.length).toBe(12 + (8 + 10) + (8 + 5 + 1) + (8 + plainVp8.length));
    expect(clean.includes("Anhang")).toBe(false);
  });

  it("gibt null für alles, was sich nicht vollständig zerlegen lässt", () => {
    const plain = testImage("plain.webp");
    const tooLong = Buffer.from(plain);
    tooLong.writeUInt32LE(plain.length, 4); // RIFF behauptet acht Bytes mehr, als da sind
    const broken = [
      tooLong,
      webpOf(riffChunk("EXIF", ascii("TestCam"))), // kein Bild vorn
      webpOf(),
      webpOf(riffChunk("VP8X", Buffer.alloc(4))), // Kopf zu kurz
      plain.subarray(0, plain.length - 4), // mitten im Chunk abgeschnitten
    ];
    for (const bytes of broken) expect(stripImageMetadata(bytes)).toBeNull();
  });
});

describe("stripImageMetadata: anderes", () => {
  it("gibt null für alles, was kein PNG, JPEG oder WebP ist", () => {
    expect(stripImageMetadata(ascii("GIF89a......"))).toBeNull();
    expect(stripImageMetadata(ascii("<svg/>"))).toBeNull();
    expect(stripImageMetadata(new Uint8Array(0))).toBeNull();
  });

  it("liefert neue Bytes und lässt die Eingabe unverändert", () => {
    const gps = testImage("gps.webp");
    const copy = Buffer.from(gps);
    const clean = stripImageMetadata(gps);
    expect(gps.equals(copy)).toBe(true);
    expect(clean?.bytes.buffer).not.toBe(gps.buffer);
  });
});
