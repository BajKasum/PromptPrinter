// Plain data module, no "use client": a Server Component importing a value
// from a "use client" file (faq.tsx used to define this locally) gets a
// client-reference proxy for every export, not the real array — `faqs.map`
// throws at request time. Both faq.tsx (the accordion) and the pricing
// page's FAQPage JSON-LD import from here instead, so there's still exactly
// one list of questions, just not defined inside a client boundary.
export const faqs = [
  {
    q: "Was, wenn der Prompt nicht passt?",
    a: "Dann sagst du mir einfach im Chat, was anders sein soll, kürzer, ausführlicher, ein anderer Ton. Ich schreib dir den ganzen Prompt neu, so oft wie nötig. Nichts ist endgültig.",
  },
  {
    q: "Was bringt mir das, statt eine KI einfach direkt zu fragen?",
    a: "Bevor du in Lovable, Cursor oder Claude Code überhaupt tippst, frag ich dich genau das, was dein Bau-Tool selbst nicht abfragt, Datenmodell, Auth, wie's aussehen soll. Das spart dir die Credits und Nachbesserungs-Runden, die ein zu vager erster Prompt sonst kostet. Der Prompt selbst ist ausserdem zugeschnitten, Lovable bekommt etwas anderes als Cursor. Und jedes Gespräch bleibt gespeichert, du erklärst nicht jedes Mal neu, woran du arbeitest.",
  },
];
