"use client";

import { useEffect, useRef } from "react";

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

  useEffect(() => {
    if (!TURNSTILE_SITE_KEY) return;
    const container = containerRef.current;
    if (!container) return;
    let cancelled = false;

    function renderWidget() {
      if (cancelled || !container || !window.turnstile || widgetIdRef.current) return;
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
    }

    return () => {
      cancelled = true;
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
  // min-h matches the widget's normal size so it never causes layout shift.
  return <div ref={containerRef} className="min-h-[65px]" />;
}
