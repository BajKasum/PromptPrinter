import { Pencil, MessageSquare, Copy } from "lucide-react";

// Plain data module, no "use client": same reason as faq-data.ts — a Server
// Component importing a value out of a "use client" file (how-it-works.tsx
// used to define these locally) gets a client-reference proxy for every
// export, not the real array, and `.map` throws at request time. Both
// HowItWorks (the animated rail) and the landing page's HowTo JSON-LD import
// from here, so there's still exactly one list of steps.
export const title = "In drei Schritten von der Idee zum fertigen Prompt.";

export const steps = [
  {
    n: "01",
    Icon: Pencil,
    title: "Sag mir, was du brauchst",
    body: "Sag mir in einem Satz, wofür du eine KI brauchst, egal wie grob. Ein Dokument, eine Webseite, eine Datenbank, eine Sicherheitsprüfung: ein paar Notizen reichen. Ich hol dich da ab, wo du gerade stehst.",
  },
  {
    n: "02",
    Icon: MessageSquare,
    title: "Wir klären es kurz",
    body: "Ich stell dir ein paar einfache Fragen, nur zu dem, was für deine Aufgabe zählt, und helf dir beim Entscheiden, wenn du etwas noch nicht weisst.",
    chat: true,
  },
  {
    n: "03",
    Icon: Copy,
    title: "Du bekommst deinen Prompt, startklar",
    body: "Fertig formuliert, direkt im Chat, und er funktioniert in jeder KI. Ein Klick, kopiert, und du legst los.",
  },
];
