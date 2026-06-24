"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Plus } from "lucide-react";
import { FadeIn } from "@/components/motion/fade-in";
import { cn } from "@/lib/utils";

const faqs = [
  {
    q: "Muss ich programmieren können?",
    a: "Nein. Du beschreibst deine Idee in ganz normaler Sprache, den technischen Teil übernehme ich. Was du bekommst, bringt dich auch ohne tiefes Vorwissen voran.",
  },
  {
    q: "Was, wenn der Plan nicht zu meinem Projekt passt?",
    a: "Dann sagst du's mir und wir passen ihn an. Nichts ist endgültig: Du kannst einzelne Teile neu erzeugen, nachschärfen oder den Stack wechseln, bis es wirklich zu deinem Projekt passt.",
  },
  {
    q: "Was bringt mir das, statt Claude einfach selbst zu fragen?",
    a: "Ich stelle dir erst die richtigen Fragen und schneide dann alles auf deine Tools zu. Lovable bekommt etwas anderes als Cursor. Und alles bleibt gespeichert, sodass du später weiterarbeitest, statt jeden Chat neu zu erklären.",
  },
  {
    q: "Was, wenn ich die Technik noch gar nicht festgelegt habe?",
    a: "Das ist der Normalfall. Sag mir einfach, was du vorhast, dann schlage ich dir einen passenden Stack vor. Ändern kannst du ihn jederzeit.",
  },
  {
    q: "Ist meine Idee bei dir sicher?",
    a: "Ja. Deine Projekte gehören nur dir und sind fest an dein Konto gebunden. Niemand sonst sieht sie. Löschst du ein Projekt, ist es endgültig weg.",
  },
  {
    q: "Gehört mir, was dabei rauskommt?",
    a: "Ja. Was du erstellst, gehört dir. Du kopierst es raus und baust damit weiter, wo du willst. Nichts hält dich an PromptPrinter fest.",
  },
];

export function FAQ() {
  return (
    <section className="container-x py-24 md:py-32">
      <FadeIn>
        <div className="max-w-2xl mb-10">
          <h2 className="text-balance text-[36px] md:text-[48px] leading-[1.1] tracking-[-0.03em] font-semibold text-foreground">
            Fragen, beantwortet.
          </h2>
        </div>
      </FadeIn>

      <FadeIn delay={0.1}>
        <div className="max-w-3xl rounded-2xl border border-border bg-surface divide-y divide-border">
          {faqs.map((f, i) => (
            <FAQItem key={i} index={i} q={f.q} a={f.a} />
          ))}
        </div>
      </FadeIn>
    </section>
  );
}

function FAQItem({ index, q, a }: { index: number; q: string; a: string }) {
  const [open, setOpen] = useState(false);
  const triggerId = `faq-trigger-${index}`;
  const panelId = `faq-panel-${index}`;
  return (
    <div>
      <button
        id={triggerId}
        aria-expanded={open}
        aria-controls={panelId}
        onClick={() => setOpen((o) => !o)}
        className="w-full flex items-start justify-between gap-6 px-6 py-5 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50 focus-visible:ring-inset rounded-2xl"
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
            id={panelId}
            role="region"
            aria-labelledby={triggerId}
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
