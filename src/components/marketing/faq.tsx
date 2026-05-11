"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Plus } from "lucide-react";
import { FadeIn } from "@/components/motion/fade-in";
import { cn } from "@/lib/utils";

const faqs = [
  {
    q: "What does PromptPrinter actually output?",
    a: "Every project produces a complete build packet: product brief, PRD, master prompt, frontend prompt, backend prompt, database schema, security checklist, marketing copy, SEO plan, and deployment guide. You can copy each individually or export the lot as Markdown or PDF.",
  },
  {
    q: "How is this different from just asking Claude for a PRD?",
    a: "PromptPrinter chains structured prompts behind the scenes, validates each output, and tailors the result to your chosen tools (Lovable vs v0 produces different frontend prompts). It also saves every artifact to a workspace you can revisit.",
  },
  {
    q: "Which AI models power the generation?",
    a: "We use Claude (4.7 family) for long-context reasoning and GPT-4o for code-heavy outputs. Your choice of master-prompt target only changes the formatting of the final artifact — the engine routes to the best model per task.",
  },
  {
    q: "Do you store my prompts and outputs?",
    a: "Yes — your projects live in your workspace so you can revisit, re-export, or fork them. Everything is row-level-secured to your account. Delete a project and it's gone for good.",
  },
  {
    q: "Can I bring my own API keys?",
    a: "On Pro and Team plans, yes. Add your Anthropic or OpenAI key in Settings and we'll use it for your generations, billing you only for the platform layer.",
  },
  {
    q: "Is there a free tier?",
    a: "Yes — 3 projects and 20 generations per month, with full access to every output type. No credit card.",
  },
];

export function FAQ() {
  return (
    <section className="container-x py-24 md:py-32">
      <FadeIn>
        <div className="max-w-2xl mb-10">
          <div className="text-[11px] font-mono uppercase tracking-[0.08em] text-violet-300/80 mb-4">
            FAQ
          </div>
          <h2 className="text-balance text-[36px] md:text-[48px] leading-[1.1] tracking-[-0.03em] font-semibold text-white">
            Questions, answered.
          </h2>
        </div>
      </FadeIn>

      <FadeIn delay={0.1}>
        <div className="max-w-3xl rounded-2xl border border-white/[0.08] bg-white/[0.02] divide-y divide-white/[0.06]">
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
        <span className="text-[15.5px] font-medium text-white pr-4">{q}</span>
        <Plus
          className={cn(
            "h-5 w-5 text-white/45 shrink-0 mt-0.5 transition-transform duration-300",
            open && "rotate-45 text-white"
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
            <div className="px-6 pb-5 text-[14.5px] leading-[1.65] text-white/65">
              {a}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
