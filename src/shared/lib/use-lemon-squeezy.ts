"use client";

import "client-only";

import { useCallback, useEffect, useRef, useState } from "react";

/**
 * Anbindung an Lemon.js, das Overlay-Skript von Lemon Squeezy.
 *
 * ─── Warum nicht der offizielle Schnipsel ──────────────────────────────────
 * Lemon Squeezy gibt einen `<a class="lemonsqueezy-button">` plus `<script>`
 * aus. Das Skript bindet dann bei jedem `Refresh()` einen Klick-Handler an
 * JEDES Element mit dieser Klasse — und entfernt vorher keinen. Im Quelltext
 * (assets.lemonsqueezy.com/lemon.js, geprüft am 04.08.2026) ist das eine
 * einzelne Zeile ohne `removeEventListener`. In einer Seite, die einmal
 * geladen und danach nur noch clientseitig navigiert wird, wächst die Zahl
 * der Handler damit unbegrenzt. Sichtbar kaputt geht dabei nichts (das
 * Skript sperrt sich über `document.body.classList` gegen ein zweites
 * Overlay), es ist einfach ein Leck.
 *
 * Deshalb benutzt dieses Projekt die Klasse NICHT, sondern ruft
 * `LemonSqueezy.Url.Open(url)` direkt im eigenen `onClick` auf. Damit ist
 * `Refresh()` für uns ein garantierter No-Op, und der einzige globale
 * Zuhörer ist der `message`-Handler, den das Skript genau einmal einhängt.
 *
 * ─── Warum wir `createLemonSqueezy()` selbst aufrufen ──────────────────────
 * Das Skript hängt sich für seine eigene Initialisierung an `window.onload`.
 * Über next/script wird es aber typischerweise NACH diesem Ereignis
 * nachgeladen — dann feuert es nie, und `window.LemonSqueezy` entsteht nicht.
 * Der Aufruf muss also von uns kommen, sobald das Skript da ist.
 */

/**
 * Was der `message`-Handler von der Checkout-Seite durchreicht.
 *
 * Zwei Formen, beide echt: benannte Ereignisse kommen als Objekt
 * (`{ event: "Checkout.Success", data }`), die zwei Zustandsmeldungen des
 * Rahmens kommen als blosser String (`"mounted"`, `"close"`).
 */
export type LemonSqueezyEvent = string | { event?: string; data?: unknown };

type LemonSqueezyApi = {
  Setup(options: { eventHandler: (event: LemonSqueezyEvent) => void }): void;
  Refresh(): void;
  Url: { Open(url: string): void; Close(): void };
  Loader: { Hide(): void };
};

/**
 * Wie lange auf das Erscheinen der Checkout-Seite gewartet wird, bevor wir
 * den Weg wechseln.
 *
 * Der Grund ist ein beobachteter, nicht ausgedachter Fehlerfall: Lemon.js
 * legt beim Öffnen einen Ladeschleier über die ganze Seite und entfernt ihn
 * erst, wenn die eingebettete Seite `"mounted"` zurückmeldet. Kommt diese
 * Meldung nie — Anbieter gestört, Verbindung weg —, gibt es im Skript nichts,
 * was den Schleier je wieder wegnimmt: der Besucher sieht eine leere Fläche
 * und kommt nur per Neuladen zurück. Zehn Sekunden sind lang genug für eine
 * schlechte Mobilverbindung und kurz genug, dass niemand ratlos wartet.
 */
const CHECKOUT_MOUNT_TIMEOUT_MS = 10_000;

declare global {
  interface Window {
    createLemonSqueezy?: () => void;
    LemonSqueezy?: LemonSqueezyApi;
  }
}

/** Adresse des Skripts. Der `app.`-Host antwortet mit 301 auf `assets.` — beide stehen deshalb in der CSP. */
export const LEMON_JS_SRC = "https://app.lemonsqueezy.com/js/lemon.js";

/** Feste ID, damit next/script das Skript pro Seite nur einmal einhängt, egal wie viele Buttons es gibt. */
export const LEMON_JS_ID = "lemonsqueezy-js";

/**
 * Ein Ereignis-Handler für die ganze Seite.
 *
 * `Setup()` kennt nur einen einzigen Handler-Platz — der letzte Aufruf
 * gewinnt. Mit mehreren Buttons auf einer Seite (Preisseite: heute einer,
 * morgen vielleicht Monats- und Jahresplan) würde sich der zweite den ersten
 * überschreiben. Deshalb registriert dieses Modul genau einen Handler und
 * verteilt an alle angemeldeten Zuhörer.
 */
const listeners = new Set<(event: LemonSqueezyEvent) => void>();
let eventHandlerInstalled = false;

function installEventHandler(api: LemonSqueezyApi): void {
  if (eventHandlerInstalled) return;
  api.Setup({
    eventHandler(event) {
      // Kopie, damit ein Zuhörer, der sich im Handler abmeldet, die laufende
      // Iteration nicht beeinflusst.
      for (const listener of [...listeners]) listener(event);
    },
  });
  eventHandlerInstalled = true;
}

export type LemonSqueezyStatus = "loading" | "ready" | "error";

export type UseLemonSqueezy = {
  status: LemonSqueezyStatus;
  /** An next/script's `onReady` hängen. Feuert auch bei jedem weiteren Mount, wenn das Skript schon liegt. */
  handleScriptReady: () => void;
  /** An next/script's `onError` hängen. */
  handleScriptError: () => void;
  /**
   * Öffnet den Checkout als Overlay.
   *
   * Gibt `false` zurück, wenn Lemon.js (noch) nicht bereit ist. Der Aufrufer
   * lässt den Klick dann durch, statt ihn ins Leere laufen zu lassen — der
   * Link führt auf dieselbe Adresse, nur eben als ganze Seite.
   */
  openCheckout: (url: string) => boolean;
};

export function useLemonSqueezy(onEvent?: (event: LemonSqueezyEvent) => void): UseLemonSqueezy {
  const [status, setStatus] = useState<LemonSqueezyStatus>("loading");

  // Der Zuhörer, der sich anmeldet, bleibt über die ganze Lebenszeit derselbe;
  // nur die Funktion dahinter wird ausgetauscht. So muss der Aufrufer seinen
  // Callback nicht memoisieren, und trotzdem gibt es pro Mount genau eine
  // An- und eine Abmeldung.
  const onEventRef = useRef(onEvent);
  useEffect(() => {
    onEventRef.current = onEvent;
  }, [onEvent]);

  // Läuft, solange auf das Erscheinen der eingebetteten Seite gewartet wird.
  const mountTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const clearMountTimer = useCallback(() => {
    if (mountTimer.current === null) return;
    clearTimeout(mountTimer.current);
    mountTimer.current = null;
  }, []);

  useEffect(() => {
    const listener = (event: LemonSqueezyEvent) => {
      // Beide Meldungen beenden das Warten: `mounted` heisst, die Seite ist
      // da; `close` heisst, der Besucher hat abgebrochen — in beiden Fällen
      // darf die Notbremse unten nicht mehr feuern.
      if (event === "mounted" || event === "close") clearMountTimer();
      onEventRef.current?.(event);
    };
    listeners.add(listener);
    return () => {
      listeners.delete(listener);
    };
  }, [clearMountTimer]);

  // Ein offener Zeitgeber überlebt sonst den Wechsel auf eine andere Seite
  // und schickt den Besucher von dort aus in den Checkout.
  useEffect(() => clearMountTimer, [clearMountTimer]);

  const activate = useCallback(() => {
    if (typeof window === "undefined") return;
    window.createLemonSqueezy?.();
    const api = window.LemonSqueezy;
    if (!api) {
      setStatus("error");
      return;
    }
    installEventHandler(api);
    setStatus("ready");
  }, []);

  // Zweiter Weg zum selben Ziel: war das Skript beim Mounten schon geladen
  // (zweiter Button, Rücknavigation), verlassen wir uns nicht darauf, dass
  // next/script sein `onReady` noch einmal schickt.
  useEffect(() => {
    if (typeof window !== "undefined" && window.LemonSqueezy) activate();
  }, [activate]);

  const openCheckout = useCallback(
    (url: string) => {
      const api = typeof window === "undefined" ? undefined : window.LemonSqueezy;
      if (!api) return false;

      api.Url.Open(url);

      clearMountTimer();
      mountTimer.current = setTimeout(() => {
        mountTimer.current = null;
        // Aufräumen, was Lemon.js selbst liegen lässt, und dann auf dem
        // ehrlichen Weg weiter: dieselbe Adresse als ganze Seite. Ist der
        // Anbieter wirklich gestört, sieht der Besucher dessen Fehlerseite
        // statt unseres endlosen Ladeschleiers.
        api.Url.Close();
        api.Loader.Hide();
        window.location.assign(url);
      }, CHECKOUT_MOUNT_TIMEOUT_MS);

      return true;
    },
    [clearMountTimer]
  );

  return {
    status,
    handleScriptReady: activate,
    handleScriptError: useCallback(() => setStatus("error"), []),
    openCheckout,
  };
}
