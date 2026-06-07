"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Plus } from "lucide-react";
import { FadeIn } from "@/components/motion/fade-in";
import { cn } from "@/lib/utils";

const faqs = [
  {
    q: "Was gibt PromptPrinter eigentlich aus?",
    a: "Jedes Projekt erzeugt ein komplettes Build-Packet: Produkt-Brief, PRD, Master-Prompt, Frontend-Prompt, Backend-Prompt, Datenbank-Schema, Sicherheits-Checkliste, Marketing-Texte, SEO-Plan und Deployment-Anleitung. Du kannst jedes einzeln kopieren oder alles als Markdown oder PDF exportieren.",
  },
  {
    q: "Worin unterscheidet sich das davon, Claude einfach nach einem PRD zu fragen?",
    a: "PromptPrinter verkettet im Hintergrund strukturierte Prompts, validiert jede Ausgabe und schneidet das Ergebnis auf deine gewählten Tools zu (Lovable vs. v0 erzeugt unterschiedliche Frontend-Prompts). Ausserdem speichert es jedes Artefakt in einem Workspace, den du wieder aufrufen kannst.",
  },
  {
    q: "Welche KI-Modelle treiben die Generierung an?",
    a: "Wir nutzen Claude (4.7-Familie) für Long-Context-Reasoning und GPT-4o für code-lastige Ausgaben. Deine Wahl des Master-Prompt-Ziels ändert nur die Formatierung des finalen Artefakts — die Engine leitet jede Aufgabe an das beste Modell weiter.",
  },
  {
    q: "Speichert ihr meine Prompts und Ausgaben?",
    a: "Ja — deine Projekte liegen in deinem Workspace, damit du sie wieder aufrufen, neu exportieren oder forken kannst. Alles ist per Row-Level-Security an dein Konto gebunden. Löschst du ein Projekt, ist es endgültig weg.",
  },
  {
    q: "Kann ich eigene API-Keys verwenden?",
    a: "In den Plänen Pro und Team ja. Hinterlege deinen Anthropic- oder OpenAI-Key in den Einstellungen, und wir nutzen ihn für deine Generierungen — abgerechnet wird dann nur die Plattform-Ebene.",
  },
  {
    q: "Gibt es eine kostenlose Stufe?",
    a: "Ja — 3 Projekte und 20 Generierungen pro Monat, mit vollem Zugriff auf jeden Ausgabetyp. Keine Kreditkarte.",
  },
];

export function FAQ() {
  return (
    <section className="container-x py-24 md:py-32">
      <FadeIn>
        <div className="max-w-2xl mb-10">
          <div className="text-[11px] font-mono uppercase tracking-[0.08em] text-accent-text mb-4">
            FAQ
          </div>
          <h2 className="text-balance text-[36px] md:text-[48px] leading-[1.1] tracking-[-0.03em] font-semibold text-foreground">
            Fragen, beantwortet.
          </h2>
        </div>
      </FadeIn>

      <FadeIn delay={0.1}>
        <div className="max-w-3xl rounded-2xl border border-border bg-surface divide-y divide-border">
          {faqs.map((f, i) => (
            <FAQItem key={i} q={f.q} a={f.a} />
          ))}
        </div>
      </FadeIn>
    </section>
  );
}

function FAQItem({ q, a }: { q: string; a: string }) {
  const [open, setOpen] = useState(false);
  return (
    <div>
      <button
        onClick={() => setOpen((o) => !o)}
        className="w-full flex items-start justify-between gap-6 px-6 py-5 text-left"
      >
        <span className="text-[15.5px] font-medium text-foreground pr-4">{q}</span>
        <Plus
          className={cn(
            "h-5 w-5 text-foreground/45 shrink-0 mt-0.5 transition-transform duration-300",
            open && "rotate-45 text-foreground"
          )}
          strokeWidth={1.8}
        />
      </button>
      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
            className="overflow-hidden"
          >
            <div className="px-6 pb-5 text-[14.5px] leading-[1.65] text-foreground/65">
              {a}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
