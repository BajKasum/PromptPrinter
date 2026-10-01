"use client";

import type { ReactNode } from "react";
import { ExternalLink } from "lucide-react";
import { useT } from "@/shared/i18n/provider";

// Die Adresse und der Knopfname stehen in Googles eigener Anleitung
// (ai.google.dev/gemini-api/docs/api-key, am 01.10.2026 gegen die Quelle
// gelesen): aistudio.google.com/apikey, dort "Create API key". Ändert Google
// einen davon, ist diese Anleitung falsch, also bei Beschwerden zuerst dort
// nachsehen.
const AI_STUDIO_URL = "https://aistudio.google.com/apikey";
// Die Datennutzung im Gratis-Zugang steht in den Gemini-API-Bedingungen
// (gleiches Datum): ausserhalb von EU, Schweiz und Grossbritannien darf Google
// Eingaben des Gratis-Zugangs zur Verbesserung seiner Produkte nutzen, dort
// gelten die Regeln der bezahlten Dienste auch für den Gratis-Zugang.
const GEMINI_TERMS_URL = "https://ai.google.dev/gemini-api/terms";

/**
 * Die Anleitung zu einem kostenlosen Gemini-Key (Audit 23.09.2026, P-1).
 *
 * Free chattet nur mit eigenem Key, und die Zielgruppe hat meist ein Lovable-
 * oder ChatGPT-Abo, aber keinen API-Key. Der Weg dahin war bisher ein
 * Rätselraten. Drei Schritte, der dritte ist das Einfügen: im Chat steht das
 * Feld direkt darunter (`field`), in den Einstellungen steht es schon darüber.
 */
export function KeyGuide({ field }: { field?: ReactNode }) {
  const t = useT();
  return (
    <div>
      <ol className="space-y-2.5 text-[13px] leading-relaxed text-secondary">
        <Step n={1}>
          <span>{t.keyGuide.step1}</span>{" "}
          <a
            href={AI_STUDIO_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 font-medium text-accent-text underline underline-offset-2 hover:text-foreground"
          >
            {t.keyGuide.step1Link}
            <ExternalLink className="h-3 w-3" aria-hidden />
            <span className="sr-only">{t.common.opensInNewTab}</span>
          </a>
        </Step>
        <Step n={2}>{t.keyGuide.step2}</Step>
        <Step n={3}>
          <span>{field ? t.keyGuide.step3Here : t.keyGuide.step3Above}</span>
          {field && <div className="mt-2">{field}</div>}
        </Step>
      </ol>

      <div className="mt-3 space-y-1.5 text-[11.5px] leading-relaxed text-tertiary">
        <p>{t.keyGuide.limits}</p>
        <p>
          {t.keyGuide.privacy}{" "}
          <a
            href={GEMINI_TERMS_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="underline underline-offset-2 hover:text-foreground"
          >
            {t.keyGuide.privacyLink}
            <span className="sr-only">{t.common.opensInNewTab}</span>
          </a>
        </p>
      </div>
    </div>
  );
}

function Step({ n, children }: { n: number; children: ReactNode }) {
  return (
    <li className="flex gap-2.5">
      <span
        aria-hidden
        className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-accent/15 text-[11px] font-medium text-accent-text"
      >
        {n}
      </span>
      <div className="min-w-0 flex-1">{children}</div>
    </li>
  );
}
