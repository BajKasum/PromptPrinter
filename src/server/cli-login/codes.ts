import "server-only";

import { createHash, randomBytes, randomInt } from "node:crypto";
import { USER_CODE_ALPHABET, USER_CODE_LENGTH } from "@/shared/lib/cli-user-code";

// Die Codes der Geräte-Anmeldung (api/cli). Zwei Codes mit zwei Aufgaben:
//   - der Geräte-Code gehört dem Terminal: 32 Byte Zufall, wer ihn hat, holt nach der Freigabe die
//     Sitzung ab. In der Datenbank steht nur sein SHA-256, ein Blick in die Tabelle hilft nicht.
//   - der Nutzer-Code gehört dem Menschen: acht Zeichen zum Abtippen im Browser (shared/lib/cli-user-code.ts).

/** Wie lange eine Anfrage lebt: vom Geräte-Code bis zur Abholung. */
export const DEVICE_REQUEST_TTL_MS = 10 * 60 * 1000;

/** Wie oft das Terminal nachfragen soll, in Sekunden. Sagt der Server ihm in der Antwort mit. */
export const POLL_INTERVAL_SECONDS = 5;

/** Wer öfter nachfragt, bekommt slow_down. Unter dem Soll-Abstand, damit Zeitschwankungen nichts abweisen. */
export const MIN_POLL_GAP_MS = 2000;

/** Form eines Geräte-Codes (32 Byte als base64url). Alles andere ist kein Code und kostet keine Abfrage. */
export const DEVICE_CODE_PATTERN = /^[A-Za-z0-9_-]{43}$/;

export function newDeviceCode(): string {
  return randomBytes(32).toString("base64url");
}

export function hashDeviceCode(deviceCode: string): string {
  return createHash("sha256").update(deviceCode).digest("hex");
}

/** `randomInt` statt `Math.random()`: gleichverteilt und nicht vorhersagbar. */
export function newUserCode(): string {
  let code = "";
  for (let i = 0; i < USER_CODE_LENGTH; i += 1) {
    code += USER_CODE_ALPHABET[randomInt(USER_CODE_ALPHABET.length)];
  }
  return code;
}

/**
 * Der Name, mit dem sich das Terminal meldet, bereinigt: ohne Steuerzeichen und ohne Zeichen, die die
 * Leserichtung umschalten oder unsichtbar sind (sonst ließe sich auf der Bestätigungsseite ein anderer
 * Name vortäuschen), Leerraum zusammengezogen, auf 60 Zeichen gekürzt (die Spalte erlaubt nicht mehr).
 * Er wird dem Nutzer nur angezeigt, nie als vertrauenswürdig behandelt.
 */
export function cleanClientName(raw: string | undefined): string {
  return (raw ?? "")
    .replace(/[\p{Cc}\p{Cf}\p{Zl}\p{Zp}]/gu, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 60);
}
