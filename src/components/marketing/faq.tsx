"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Plus } from "lucide-react";
import { FadeIn } from "@/components/motion/fade-in";
import { cn } from "@/lib/utils";

const faqs = [
  {
    q: "Muss ich programmieren können?",
    a: "Nein. Du beschreibst deine Idee in ganz normaler Sprache — den technischen Teil übernehme ich. Was ich dir gebe, bringt dich auch ohne tiefes Vorwissen voran.",
  },
  {
    q: "Was bekomme ich am Ende?",
    a: "Einen kompletten Plan für deine App — was du baust und in welcher Reihenfolge — plus die fertigen Anweisungen für jedes KI-Tool, die Struktur deiner Datenbank, eine Sicherheits-Checkliste und sogar Texte fürs Marketing. Du kopierst, was du brauchst, oder lädst alles auf einmal.",
  },
  {
    q: "Was bringt mir das, statt Claude einfach selbst zu fragen?",
    a: "Ich stelle dir erst die richtigen Fragen und schneide dann alles auf deine Tools zu — Lovable bekommt etwas anderes als Cursor. Und alles bleibt gespeichert, sodass du später weiterarbeitest, statt jeden Chat neu zu erklären.",
  },
  {
    q: "Was, wenn ich die Technik noch gar nicht festgelegt habe?",
    a: "Das ist der Normalfall. Sag mir einfach, was du vorhast — ich schlage dir einen passenden Stack vor. Ändern kannst du ihn jederzeit.",
  },
  {
    q: "Ist meine Idee bei dir sicher?",
    a: "Ja. Deine Projekte gehören nur dir und sind fest an dein Konto gebunden — niemand sonst sieht sie. Löschst du ein Projekt, ist es endgültig weg.",
  },
  {
    q: "Kann ich kostenlos starten?",
    a: "Ja — kostenlos und ohne Kreditkarte. Du bekommst genug, um mehrere komplette Projekte auszuprobieren, bevor du dich entscheidest.",
  },
];

export function FAQ() {
  return (
    <section className="container-x py-24 md:py-32">
      <FadeIn>
        <div className="max-w-2xl mb-10">
          <div className="text-[11px] font-mono uppercase tracking-[0.08em] text-accent-text mb-4">
            Noch Fragen?
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
