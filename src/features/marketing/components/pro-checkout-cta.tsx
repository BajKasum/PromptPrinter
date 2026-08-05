"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { createClient } from "@/shared/supabase/client";
import { Button } from "@/shared/ui/button";
import { LemonCheckoutButton } from "@/shared/ui/lemon-checkout-button";
import type { MarketingPlan } from "@/shared/lib/pricing";

type Buyer = { email: string | null; userId: string };

/**
 * Der Pro-Knopf auf der ÖFFENTLICHEN Preisseite — anders als der auf
 * `/billing`, der weiss, wer da klickt.
 *
 * ─── Das Problem, das dieser Knopf löst ────────────────────────────────────
 * Ein Kauf, der auf `/pricing` beginnt, trägt standardmässig keine Konto-ID:
 * `custom_data.user_id` (server/billing/lemonsqueezy.ts) kommt nur mit, wenn
 * WIR sie mitgeben, und ein anonymer Besucher hat keine. Der Webhook kann die
 * Zahlung dann keinem Konto zuordnen (`billing.webhook_unmatched`) — das Geld
 * ist da, die Freischaltung wird Handarbeit. Direkt in den Checkout zu
 * schicken war für einen eingeloggten Besucher schon richtig (die Zuordnung
 * klappt), für den weit häufigeren ausgeloggten Fall aber genau der Weg, der
 * garantiert unzuordenbar bleibt.
 *
 * ─── Warum das hier und nicht serverseitig geprüft wird ────────────────────
 * `/pricing` ist seit Planpunkt B-2 statisch vorgerendert (`bf6c4e8`) — ein
 * `supabase.auth.getUser()` im Server-Component-Baum würde die Seite wieder
 * bei jedem Aufruf dynamisch rendern und genau den gemessenen Gewinn (TTFB,
 * CDN-Cache) rückgängig machen, für eine Randfrage, die nur den Pro-Knopf
 * betrifft. Die Prüfung läuft deshalb ausschliesslich hier, in einem eigenen
 * Client-Chip, während der Rest der Seite statisch bleibt.
 *
 * ─── Warum der Ausgangszustand ein Link ist, kein Ladezustand ─────────────
 * Der erste gerenderte Zustand — vor UND kurz nach der Hydration, während
 * `getUser()` noch unterwegs ist — ist ein gewöhnlicher `<Link>` auf
 * `plan.href` (`/signup?plan=pro`), identisch mit dem serverseitig
 * ausgelieferten HTML. Kein Hydrations-Sprung, und der weit häufigere
 * ausgeloggte Besucher sieht nie etwas anderes. Erst wenn eine echte Sitzung
 * bestätigt ist, wird auf den direkten Checkout umgeschaltet (mit Mail und
 * Konto-ID, wie auf `/billing`) — ein eingeloggter Besucher, der zufällig auf
 * der öffentlichen Preisseite statt auf `/billing` landet, verliert dadurch
 * nichts, ausser einer kurzen, folgenlosen Verzögerung.
 */
export function ProCheckoutCta({ plan }: { plan: MarketingPlan }) {
  const [buyer, setBuyer] = useState<Buyer | null>(null);

  useEffect(() => {
    let cancelled = false;
    createClient()
      .auth.getUser()
      .then(({ data }) => {
        if (!cancelled && data.user) {
          setBuyer({ email: data.user.email ?? null, userId: data.user.id });
        }
      });
    return () => {
      cancelled = true;
    };
  }, []);

  if (buyer) {
    return (
      <LemonCheckoutButton
        fallbackHref={plan.href}
        email={buyer.email}
        userId={buyer.userId}
        variant="accent"
        className="w-full mt-6"
        successMessage="Danke! Deine Zahlung ist angekommen. Ich schalte dieses Konto auf Pro und melde mich, sobald es so weit ist."
      >
        {plan.cta}
      </LemonCheckoutButton>
    );
  }

  return (
    <Button asChild variant="accent" className="w-full mt-6">
      <Link href={plan.href}>{plan.cta}</Link>
    </Button>
  );
}
