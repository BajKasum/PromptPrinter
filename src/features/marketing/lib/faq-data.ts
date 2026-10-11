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
    a: "Ein zu vager erster Prompt kostet dich Nachbesserungs-Runden, und je nach Tool auch Credits. Bevor ich schreibe, frag ich dich deshalb genau das, was für deine Aufgabe zählt: bei einem Text zum Beispiel, für wen er ist und wie er klingen soll, bei einer Datenbank oder einer Sicherheitsprüfung, was genau dazugehört. Der Prompt funktioniert in jeder KI, und sagst du mir, in welche er soll, schreibe ich ihn darauf zu. Und jedes Gespräch bleibt gespeichert, du erklärst nicht jedes Mal neu, woran du arbeitest.",
  },
];
