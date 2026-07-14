"use client";

import { useEffect, useRef } from "react";

/**
 * Cloudflare Turnstile site key, public by design (NEXT_PUBLIC_). When unset,
 * the widget renders nothing and the auth forms skip their captcha guard, so
 * local dev and tests keep working without any Cloudflare setup. The matching
 * SECRET key never touches this app: it goes into Supabase → Authentication →
 * Attack Protection → CAPTCHA (Turnstile), and Supabase verifies the token
 * server-side on every auth call that carries `captchaToken`.
 */
export const TURNSTILE_SITE_KEY = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY;

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
