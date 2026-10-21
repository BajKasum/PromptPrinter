"use client";

import { useState, type ComponentProps } from "react";
import Link from "next/link";

/**
 * Ein Link, der erst prefetcht, wenn ihn jemand ansteuert (Maus, Tastatur, Finger).
 *
 * Next prefetcht jeden `<Link>` im Sichtbereich. Bei einer Liste mit hundert Chats sind das hundert
 * Anfragen an dynamische Routen, jede durch die Middleware und eine Auth-Abfrage bei Supabase, fuer
 * Chats, die fast nie geoeffnet werden (#157). `prefetch={false}` allein haelt auch das Prefetchen beim
 * Ueberfahren aus. Deshalb schaltet diese Huelle bei Hover, Fokus oder Beruehrung auf den Standard um:
 * der Klick bleibt schnell, der Rest der Liste kostet nichts. Das Muster steht so in der Next-Doku.
 *
 * Fuer lange Listen (Chats, Projekte). Ein einzelner Link, den fast jeder anklickt, bleibt ein `<Link>`.
 */
export function HoverPrefetchLink({
  onMouseEnter,
  onFocus,
  onTouchStart,
  ...props
}: Omit<ComponentProps<typeof Link>, "prefetch">) {
  const [armed, setArmed] = useState(false);
  return (
    <Link
      {...props}
      prefetch={armed ? null : false}
      onMouseEnter={(e) => {
        setArmed(true);
        onMouseEnter?.(e);
      }}
      onFocus={(e) => {
        setArmed(true);
        onFocus?.(e);
      }}
      onTouchStart={(e) => {
        setArmed(true);
        onTouchStart?.(e);
      }}
    />
  );
}
