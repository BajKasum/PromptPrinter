import Link from "next/link";
import { AUTHOR_PATH, formatLongDate } from "@/features/marketing/lib/article-schema";
import { LEGAL } from "@/shared/lib/legal";
import { cn } from "@/shared/lib/utils";

/**
 * Autorenzeile unter dem Seitenkopf: wer den Text geschrieben hat und von
 * wann er ist.
 *
 * Der Name verlinkt auf /ueber, die eine Seite, auf der sich der Mensch
 * hinter PromptPrinter vorstellt. Das Datum ist ein echtes `<time>`, dieselbe
 * Angabe steht als `dateModified` im JSON-LD der Seite (article-schema.ts).
 */
export function Byline({ updated, className }: { updated: string; className?: string }) {
  return (
    <p className={cn("text-[13px] leading-[1.6] text-tertiary", className)}>
      Von{" "}
      <Link
        href={AUTHOR_PATH}
        rel="author"
        className="text-secondary underline underline-offset-2 transition-colors hover:text-foreground"
      >
        {LEGAL.operator}
      </Link>
      <span aria-hidden> · </span>
      Aktualisiert am <time dateTime={updated}>{formatLongDate(updated)}</time>
    </p>
  );
}
