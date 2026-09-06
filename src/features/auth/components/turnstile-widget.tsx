"use client";

import { useEffect, useRef, useState } from "react";

/**
 * Cloudflare Turnstile site key, public by design (NEXT_PUBLIC_). When unset,
 * the widget renders nothing and the auth forms skip their captcha guard, so
 * local dev and tests keep working without any Cloudflare setup.
 *
 * The matching SECRET lives in this app's own environment as TURNSTILE_SECRET
 * and is redeemed by POST /api/auth (see lib/turnstile.ts). It used to be
 * documented here as belonging in Supabase → Authentication → Attack
 * Protection → CAPTCHA instead — but that setting was never switched on, so
 * for as long as that comment stood, nothing verified these tokens at all.
 *
 * ⚠️ Enabling the Supabase setting NOW would break logins rather than add a
 * second layer: a token can be redeemed once, and /api/auth already redeems it.
 */
export const TURNSTILE_SITE_KEY = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY;

/**
 * Segments this integration in the Turnstile dashboard's analytics. Not a
 * security control — the server does not compare it on the way back, since all
 * four auth surfaces share one action, so a check would reject nothing real
 * while turning a tab left open across a deploy into a failed human check.
 */
const TURNSTILE_ACTION = "turnstile-spin-v2";

type TurnstileApi = {
  render: (container: HTMLElement, params: Record<string, unknown>) => string;
  reset: (widgetId?: string) => void;
  remove: (widgetId: string) => void;
};

declare global {
  interface Window {
    turnstile?: TurnstileApi;
  }
}

const SCRIPT_SRC = "https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit";

// M-9 (Audit 06.09.2026): ohne eine Obergrenze blieb der Nutzer bei einem
// blockierten oder nie ankommenden Skript (Adblocker, Firmenproxy, eine
// Cloudflare-Stoerung) vor einer leeren 65px-Box stehen, die Formulare
// forderten weiterhin "bestaetige, dass du ein Mensch bist" -- eine
// Aufforderung, die nichts auf dem Bildschirm erfuellen konnte. Grosszuegig
// genug, dass gewoehnliche Ladezeit (typischerweise <1s) nie ausloest.
const LOAD_TIMEOUT_MS = 8000;

/**
 * Renders the "Bestätigen Sie, dass Sie ein Mensch sind"-box and reports the
 * token upward (`null` when it expires or errors). Tokens are single-use,
 * after a failed submit the caller bumps `resetSignal` to get a fresh one.
 * `onToken` must be referentially stable (useCallback) or the widget remounts.
 */
export function TurnstileWidget({
  onToken,
  resetSignal = 0,
}: {
  onToken: (token: string | null) => void;
  resetSignal?: number;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const widgetIdRef = useRef<string | null>(null);
  // M-9: kein Zustand fuer "das Skript kam nie an" existierte bisher.
  const [loadFailed, setLoadFailed] = useState(false);

  useEffect(() => {
    if (!TURNSTILE_SITE_KEY) return;
    const container = containerRef.current;
    if (!container) return;
    let cancelled = false;
    setLoadFailed(false);

    // Faengt sowohl "das Skript kam gar nie an" (Timeout) als auch "kam an,
    // aber render() erschien nie" ab (window.turnstile ist z.B. gesetzt, doch
    // die Cloudflare-Herausforderung selbst haengt) — der Timer laeuft in
    // jedem Fall bis renderWidget ihn stoppt.
    const timeout = window.setTimeout(() => {
      if (!cancelled && !widgetIdRef.current) setLoadFailed(true);
    }, LOAD_TIMEOUT_MS);

    function renderWidget() {
      if (cancelled || !container || !window.turnstile || widgetIdRef.current) return;
      window.clearTimeout(timeout);
      widgetIdRef.current = window.turnstile.render(container, {
        sitekey: TURNSTILE_SITE_KEY,
        action: TURNSTILE_ACTION,
        // The public site is forced to the light theme (Theme-Entscheidung).
        theme: "light",
        language: "de",
        callback: (token: string) => onToken(token),
        "expired-callback": () => onToken(null),
        "error-callback": () => onToken(null),
      });
    }

    if (window.turnstile) {
      renderWidget();
    } else {
      // Load the script once, app-wide, a second widget (login → signup
      // navigation) reuses the same tag instead of appending another.
      let script = document.querySelector<HTMLScriptElement>(`script[src="${SCRIPT_SRC}"]`);
      if (!script) {
        script = document.createElement("script");
        script.src = SCRIPT_SRC;
        script.async = true;
        script.defer = true;
        document.head.appendChild(script);
      }
      script.addEventListener("load", renderWidget, { once: true });
      // M-9: ein blockiertes Skript (Adblocker, Firmenproxy) loest nie
      // "load" aus, sondern "error" — ohne diesen Listener blieb dieser
      // konkrete, haeufigste Fall unbehandelt und wartete stumm auf den
      // Timeout, statt sofort Bescheid zu geben.
      script.addEventListener(
        "error",
        () => {
          if (!cancelled) setLoadFailed(true);
        },
        { once: true }
      );
    }

    return () => {
      cancelled = true;
      window.clearTimeout(timeout);
      if (widgetIdRef.current && window.turnstile) {
        window.turnstile.remove(widgetIdRef.current);
        widgetIdRef.current = null;
      }
    };
  }, [onToken]);

  useEffect(() => {
    if (resetSignal > 0 && widgetIdRef.current && window.turnstile) {
      window.turnstile.reset(widgetIdRef.current);
    }
  }, [resetSignal]);

  if (!TURNSTILE_SITE_KEY) return null;

  if (loadFailed) {
    return (
      <p role="alert" className="min-h-[65px] text-[13px] leading-relaxed text-destructive">
        Die Mensch-Prüfung von Cloudflare konnte nicht geladen werden (Werbe-
        oder Skriptblocker? Firmennetzwerk?). Bitte deaktiviere ihn für diese
        Seite und lade sie neu.
      </p>
    );
  }

  // min-h matches the widget's normal size so it never causes layout shift.
  return <div ref={containerRef} className="min-h-[65px]" />;
}
