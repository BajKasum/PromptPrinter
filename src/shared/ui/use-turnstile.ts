"use client";

import "client-only";

import { useCallback, useState } from "react";
import { TURNSTILE_SITE_KEY } from "@/shared/ui/turnstile-widget";

/** Die Absage, wenn jemand absendet, bevor die Mensch-Prüfung ein Token geliefert hat. */
export const CAPTCHA_MISSING_MESSAGE = "Bitte bestätige kurz, dass du ein Mensch bist.";

/**
 * Der Zustand der Mensch-Prüfung eines Formulars, neben `<TurnstileWidget>`.
 *
 * Ein Turnstile-Token ist nur einmal einlösbar, und jeder Aufruf kann es verbraucht haben, auch ein gescheiterter.
 * Jeder Fehlerzweig, nach dem das Formular stehen bleibt, ruft deshalb `refresh()`: das alte Token ist weg und das
 * Widget stellt ein neues aus. Ohne das scheitert der zweite Versuch mit "timeout-or-duplicate".
 */
export function useTurnstile() {
  const [token, setToken] = useState<string | null>(null);
  const [resetSignal, setResetSignal] = useState(0);
  const refresh = useCallback(() => {
    setToken(null);
    setResetSignal((n) => n + 1);
  }, []);

  return {
    token,
    /** Ein Site-Key ist gesetzt, aber noch kein Token da: nicht absenden. */
    missing: Boolean(TURNSTILE_SITE_KEY) && !token,
    refresh,
    /** `setToken` bleibt dieselbe Funktion, sonst montierte das Widget neu. */
    widgetProps: { onToken: setToken, resetSignal },
  };
}
