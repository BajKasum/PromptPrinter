import { z } from "@/shared/lib/zod";

/**
 * Das Kontaktformular auf /kontakt: Themen, Grenzen und das Schema, das der
 * Browser vor dem Senden und die Route (`/api/contact`) beim Empfangen prüft.
 * Eine Quelle, damit beide dieselben Grenzen meinen.
 *
 * Die ersten vier Themen sind die Kacheln der Seite, in derselben Reihenfolge.
 * "melden" ist der Meldeweg für rechtswidrige Inhalte (Digital Services Act,
 * Art. 16): er hat keine Kachel, nur den Eintrag im Formular, und die Route
 * bestätigt den Eingang per Mail an den Absender (Art. 16 Abs. 4).
 */
export const CONTACT_TOPICS = ["fehler", "frage", "idee", "daten", "melden"] as const;
export type ContactTopic = (typeof CONTACT_TOPICS)[number];

export const CONTACT_TOPIC_LABELS: Record<ContactTopic, string> = {
  fehler: "Etwas ist kaputt",
  frage: "Ich komme nicht weiter",
  idee: "Mir fehlt etwas",
  daten: "Daten und Rechtliches",
  melden: "Rechtswidrigen Inhalt melden",
};

export const CONTACT_LIMITS = {
  name: 100,
  email: 254,
  messageMin: 10,
  messageMax: 4000,
} as const;

export const contactSchema = z.object({
  name: z.string().trim().max(CONTACT_LIMITS.name).optional(),
  email: z.string().trim().email().max(CONTACT_LIMITS.email),
  topic: z.enum(CONTACT_TOPICS),
  message: z.string().trim().min(CONTACT_LIMITS.messageMin).max(CONTACT_LIMITS.messageMax),
  // Köder für Bots: ein Feld, das Menschen nicht sehen und deshalb leer lassen.
  // Gefüllt heißt automatisiert; die Route antwortet dann wie bei Erfolg und
  // sendet nichts, damit der Bot nicht lernt, woran er gescheitert ist.
  website: z.string().max(200).optional(),
});

export type ContactInput = z.infer<typeof contactSchema>;
