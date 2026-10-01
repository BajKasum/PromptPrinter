import type { ComponentProps } from "react";
import { cn } from "@/shared/lib/utils";

/**
 * Einstieg für Inhalt, der im ersten Bild schon lesbar sein muss.
 *
 * Das Gegenstück zu `FadeIn`, mit einem Unterschied, der zählt: `FadeIn` ist
 * eine Client-Komponente und liefert `opacity: 0` im HTML aus, der Inhalt
 * erscheint erst nach dem Hydrieren. Für alles unterhalb des ersten Bildes
 * ist das richtig (es blendet beim Scrollen ein). Für die Überschrift und den
 * ersten Absatz einer Seite hält es genau den Text zurück, auf den der
 * Besucher wartet, und den Lighthouse als grösstes Element misst.
 *
 * `Rise` ist reines CSS (`.enter-rise` in globals.css): sichtbar ab dem
 * ersten Bild, auch ohne JavaScript, und eine Server-Komponente.
 */
export function Rise({
  delay = 0,
  className,
  style,
  ...props
}: ComponentProps<"div"> & { delay?: number }) {
  return (
    <div
      className={cn("enter-rise", className)}
      style={delay ? { animationDelay: `${delay}s`, ...style } : style}
      {...props}
    />
  );
}
