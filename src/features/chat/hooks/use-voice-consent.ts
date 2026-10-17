"use client";

import "client-only";
import { useCallback, useEffect, useState } from "react";

/**
 * Die Zustimmung zum Sprachmodus, je Browser in localStorage.
 *
 * Warum überhaupt: Chrome und Edge erkennen Sprache nicht auf dem Gerät, sie
 * schicken die Aufnahme an Google bzw. Microsoft (Datenschutz Ziffer 4). Wir
 * bekommen sie nie, aber wer den Sprachmodus öffnet, löst diese Übermittlung
 * aus. Deshalb fragt der Chat vor dem ersten Diktat und merkt sich das Ja.
 *
 * Der Wert ist die Fassung des Hinweises, nicht ein Wahrheitswert: ändert sich
 * der Text wesentlich, hier die Konstante hochsetzen, dann wird neu gefragt.
 *
 * Gespeichert wird bewusst im Browser, nicht beim Konto: die Übermittlung
 * betrifft die Spracherkennung dieses Browsers, ein Ja auf dem Laptop sagt
 * nichts über das Handy. Der Schlüssel steht in cookie-inventory.ts.
 */
export const VOICE_CONSENT_VERSION = "2026-10-17";

function read(): boolean {
  try {
    return window.localStorage.getItem("pp-voice-consent") === VOICE_CONSENT_VERSION;
  } catch {
    // Privates Fenster oder gesperrter Speicher: dann gilt das Ja nur für diese Sitzung.
    return false;
  }
}

export function useVoiceConsent(): { granted: boolean; grant: () => void; revoke: () => void } {
  // Erst nach dem Einhängen lesen: auf dem Server gibt es keinen localStorage,
  // und ein anderer Anfangswert als im Browser gäbe eine Hydration-Warnung.
  const [granted, setGranted] = useState(false);
  useEffect(() => setGranted(read()), []);

  const grant = useCallback(() => {
    try {
      window.localStorage.setItem("pp-voice-consent", VOICE_CONSENT_VERSION);
    } catch {
      /* gesperrt: gilt nur bis zum Neuladen */
    }
    setGranted(true);
  }, []);

  const revoke = useCallback(() => {
    try {
      window.localStorage.removeItem("pp-voice-consent");
    } catch {
      /* nichts zu löschen */
    }
    setGranted(false);
  }, []);

  return { granted, grant, revoke };
}
