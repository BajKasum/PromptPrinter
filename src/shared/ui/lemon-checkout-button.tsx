"use client";

import Script from "next/script";
import { useCallback, useState, type MouseEvent, type ReactNode } from "react";
import { Check } from "lucide-react";
import { Button, type ButtonProps } from "@/shared/ui/button";
import { cn } from "@/shared/lib/utils";
import { buildCheckoutUrl, checkoutUrlFromEnv } from "@/shared/lib/lemon-squeezy";
import {
  LEMON_JS_ID,
  LEMON_JS_SRC,
  useLemonSqueezy,
  type LemonSqueezyEvent,
} from "@/shared/lib/use-lemon-squeezy";

type LemonCheckoutButtonProps = {
  /** Beschriftung. */
  children: ReactNode;
  /**
   * Ziel, wenn kein Checkout konfiguriert ist (Variable nicht gesetzt oder
   * unbrauchbar). Der Aufrufer verliert dadurch nie seinen Aufruf zur
   * Handlung, er zeigt dann eben wieder dorthin, wo er vorher hinzeigte.
   */
  fallbackHref: string;
  /** Mail des angemeldeten Käufers, wird im Checkout vorausgefüllt. */
  email?: string | null;
  /** Konto-ID, reist als `custom_data` mit der Bestellung (siehe lemon-squeezy.ts). */
  userId?: string | null;
  variant?: ButtonProps["variant"];
  size?: ButtonProps["size"];
  className?: string;
  /** Text nach erfolgreichem Kauf. */
  successMessage?: string;
};

/**
 * Kauf-Knopf für den Pro-Plan.
 *
 * ─── Warum ein Link und kein Button ────────────────────────────────────────
 * Das Element ist ein echtes `<a href>` auf die Checkout-Adresse, nur optisch
 * ein Button. Damit funktioniert es in genau der Reihenfolge, in der eine
 * Seite benutzbar sein soll:
 *
 *   1. Lemon.js ist bereit  → Klick öffnet das Overlay, `preventDefault`.
 *   2. Lemon.js fehlt noch  → der Browser folgt dem Link, ganze Seite.
 *   3. Kein JavaScript      → wie 2.
 *
 * Es gibt keinen Zustand, in dem der Knopf nichts tut. Nebenbei kommt alles
 * mit, was ein Link von Haus aus kann und ein `<button onClick>` nachbauen
 * müsste: Tastaturbedienung, Vorschau der Adresse in der Statuszeile,
 * Cmd/Strg-Klick in einen neuen Tab (unten ausdrücklich durchgelassen), und
 * die richtige Ansage im Screenreader.
 */
export function LemonCheckoutButton({
  children,
  fallbackHref,
  email,
  userId,
  variant = "accent",
  size,
  className,
  successMessage = "Danke! Deine Zahlung ist angekommen.",
}: LemonCheckoutButtonProps) {
  const [purchased, setPurchased] = useState(false);

  const handleEvent = useCallback((event: LemonSqueezyEvent) => {
    // Zustandsmeldungen des Rahmens kommen als String, benannte Ereignisse
    // als Objekt — nur das eine hier interessiert.
    if (typeof event === "object" && event?.event === "Checkout.Success") setPurchased(true);
  }, []);

  const { handleScriptReady, handleScriptError, openCheckout } = useLemonSqueezy(handleEvent);

  const checkoutBase = checkoutUrlFromEnv();
  const configured = checkoutBase !== null;

  // Ohne `dark`: das href wird auf dem Server gerendert, das Thema steht aber
  // erst im Browser fest — beides in einen Wert zu giessen wäre ein
  // Hydrations-Unterschied. Der Look wird deshalb erst beim Klick angehängt,
  // wo er ohnehin gebraucht wird.
  const href = buildCheckoutUrl(checkoutBase, { email, userId }) ?? fallbackHref;

  function handleClick(clickEvent: MouseEvent<HTMLAnchorElement>) {
    if (!configured) return;
    // Cmd/Strg/Shift/Alt-Klick gehört dem Browser: neuer Tab, neues Fenster,
    // Download. Wer das drückt, will bewusst nicht das Overlay.
    if (clickEvent.metaKey || clickEvent.ctrlKey || clickEvent.shiftKey || clickEvent.altKey) {
      return;
    }

    // `dark` steuert zweierlei: den Ladeschleier von Lemon.js und den Look der
    // Checkout-Seite selbst. Direkt am <html> abgelesen statt über
    // next-themes, denn genau dieses Element trägt die Entscheidung — auch
    // dort, wo das öffentliche Marketing bewusst auf hell festgehalten wird
    // (siehe theme-provider.tsx).
    const dark = document.documentElement.classList.contains("dark");
    const url = buildCheckoutUrl(checkoutBase, { email, userId, dark });
    if (url && openCheckout(url)) clickEvent.preventDefault();
  }

  if (purchased) {
    return (
      <div
        role="status"
        className={cn(
          "flex items-start gap-2.5 rounded-lg border border-accent/30 bg-accent-subtle px-3.5 py-3 text-[13px] leading-relaxed text-accent-text",
          className
        )}
      >
        <Check className="mt-0.5 h-4 w-4 shrink-0" strokeWidth={2.2} />
        <span>{successMessage}</span>
      </div>
    );
  }

  return (
    <>
      {/* Feste ID: next/script hängt dasselbe Skript pro Seite genau einmal
          ein, auch wenn mehrere Knöpfe es anfordern. `afterInteractive` statt
          `lazyOnload`, weil das hier der Kaufweg ist — 3,8 KB, die früh genug
          da sein sollen, dass der erste Klick schon das Overlay bekommt. */}
      {configured && (
        <Script
          id={LEMON_JS_ID}
          src={LEMON_JS_SRC}
          strategy="afterInteractive"
          onReady={handleScriptReady}
          onError={handleScriptError}
        />
      )}
      <Button asChild variant={variant} size={size} className={className}>
        <a href={href} onClick={handleClick}>
          {children}
        </a>
      </Button>
    </>
  );
}
