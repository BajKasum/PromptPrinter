import { hostname } from "node:os";
import { setTimeout as sleep } from "node:timers/promises";
import { ApiError, NetworkError } from "./api.mjs";
import { sanitize } from "./text.mjs";

/** Der Text zu jedem Ergebnis von `runLogin`, als Schlüssel in `messages.mjs`. */
export const LOGIN_MESSAGES = {
  done: "loginDone",
  denied: "loginDenied",
  expired: "loginExpired",
  invalid: "loginInvalid",
  failed: "loginFailed",
  unavailable: "loginUnavailable",
  cancelled: "loginCancelled",
};

// So viele Abfragen in Folge dürfen am Server scheitern (eine gelungene setzt die Zählung zurück), bevor die
// Anmeldung aufgibt: bei fünf Sekunden Abstand rund zwei Minuten. Das überbrückt einen kurzen Ausfall, während
// der Mensch im Browser noch bestätigt, und lässt ihn bei einem langen nicht bis zum Ablauf des Codes warten.
export const MAX_SERVER_FAILURES_IN_ROW = 24;

/** Der Server sagt, wohin. Geglaubt wird das nur für den eigenen Server, sonst die bekannte Seite. */
function verificationAddress(api, uri) {
  try {
    const url = new URL(uri);
    if (url.origin === api.server) return url.href;
  } catch {
    // Keine gültige Adresse: die bekannte Seite nehmen.
  }
  return `${api.server}/cli`;
}

/**
 * Anmeldung per Geräte-Code: Code anfragen und zeigen, der Mensch bestätigt im Browser, dann genau einmal
 * die Sitzung abholen. Der Code steht bewusst nicht in der Adresse (Phishing, siehe Haupt-Repo). Das
 * Ergebnis ist ein Schlüssel von `LOGIN_MESSAGES`.
 */
export async function runLogin({ api, store, print, signal, open, wait = sleep, now = () => Date.now() }) {
  const device = await api.requestDevice(`${hostname()} (promptprinter)`);
  const address = verificationAddress(api, device.verificationUri);
  print.step("loginStart");
  print.step("loginOpen", { url: address });
  print.step("loginCode", { code: sanitize(String(device.userCode)) });
  print.step("loginWarning");
  print.step("loginWaiting");
  open?.(address);

  let interval = Math.max(1, Number(device.interval) || 5);
  const deadline = now() + (Number(device.expiresIn) || 600) * 1000;
  let serverFailures = 0;
  while (now() < deadline) {
    try {
      await wait(interval * 1000, undefined, { signal });
    } catch {
      return "cancelled";
    }
    try {
      const answer = await api.pollToken(device.deviceCode);
      serverFailures = 0;
      if (answer.status === "approved" && answer.session) {
        await store.save(answer.session);
        return "done";
      }
      if (typeof answer.interval === "number") interval = Math.max(1, answer.interval);
    } catch (err) {
      if (err instanceof NetworkError) continue;
      if (!(err instanceof ApiError)) throw err;
      if (err.kind === "slow_down") {
        // Wie RFC 8628: wer gebremst wird, fragt seltener, nicht nur gleich oft.
        interval = Math.max(interval + 5, err.interval ?? 0);
        continue;
      }
      if (err.kind === "rate_limited") {
        interval = Math.max(interval, err.retryAfter ?? interval);
        continue;
      }
      if (isServerFailure(err)) {
        // Im üblichen Abstand weiterfragen ist gefahrlos: abgeholt wird ein Code nur einmal, danach meldet
        // der Server ihn als `invalid`.
        serverFailures += 1;
        if (serverFailures >= MAX_SERVER_FAILURES_IN_ROW) return "unavailable";
        continue;
      }
      if (err.kind === "denied") return "denied";
      if (err.kind === "expired") return "expired";
      if (err.kind === "invalid") return "invalid";
      return "failed";
    }
  }
  return "expired";
}

/**
 * Der Server konnte gerade nicht antworten: die Route meldet `unavailable` (503, etwa wenn die Datenbank
 * ausfällt), und ein Status ab 500 ohne `kind` kommt nicht von ihr, sondern von der Plattform davor (etwa ein
 * Timeout am Gateway). Endgültig bleibt `session_failed`, ebenfalls 503: dann ist der Code verbraucht.
 */
function isServerFailure(err) {
  return err.kind === "unavailable" || (err.status >= 500 && err.kind === null);
}
