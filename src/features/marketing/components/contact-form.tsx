"use client";

import { useCallback, useState } from "react";
import Link from "next/link";
import { ArrowRight, Loader2, MailCheck } from "lucide-react";
import { Input, Textarea } from "@/shared/ui/input";
import { TurnstileWidget, TURNSTILE_SITE_KEY } from "@/shared/ui/turnstile-widget";
import {
  CONTACT_LIMITS,
  CONTACT_TOPICS,
  CONTACT_TOPIC_LABELS,
  contactSchema,
  type ContactTopic,
} from "@/shared/lib/contact";
import { LEGAL } from "@/shared/lib/legal";

const FALLBACK = `Keine Verbindung zum Server. Schreib mir bitte direkt an ${LEGAL.email}.`;

/**
 * Das Kontaktformular auf /kontakt, der zweite Weg neben der Mailadresse.
 *
 * Sendet an POST /api/contact (Mensch-Prüfung und Ratenlimit sitzen dort). Wer
 * das Formular nicht nutzen kann oder will, findet die Adresse direkt darüber
 * auf der Seite; jede Fehlermeldung nennt sie ausdrücklich.
 */
export function ContactForm() {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [topic, setTopic] = useState<ContactTopic>("frage");
  const [message, setMessage] = useState("");
  const [trap, setTrap] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);

  const [captchaToken, setCaptchaToken] = useState<string | null>(null);
  const [captchaNonce, setCaptchaNonce] = useState(0);
  const handleCaptchaToken = useCallback((t: string | null) => setCaptchaToken(t), []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    const parsed = contactSchema.safeParse({ name, email, topic, message, website: trap });
    if (!parsed.success) {
      const fields = new Set(parsed.error.issues.map((i) => String(i.path[0])));
      setError(
        fields.has("email")
          ? "Bitte gib eine gültige E-Mail-Adresse an, damit ich antworten kann."
          : `Die Nachricht braucht mindestens ${CONTACT_LIMITS.messageMin} und höchstens ${CONTACT_LIMITS.messageMax} Zeichen.`
      );
      return;
    }
    if (TURNSTILE_SITE_KEY && !captchaToken) {
      setError("Bitte bestätige kurz, dass du ein Mensch bist.");
      return;
    }

    setLoading(true);
    try {
      let res: Response;
      try {
        res = await fetch("/api/contact", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ ...parsed.data, turnstileToken: captchaToken ?? undefined }),
        });
      } catch {
        setError(FALLBACK);
        return;
      }
      if (!res.ok) {
        const payload = (await res.json().catch(() => null)) as { detail?: string } | null;
        setError(payload?.detail ?? `Das hat nicht geklappt. Schreib mir bitte direkt an ${LEGAL.email}.`);
        // Ein Token gilt nur einmal und ist verbraucht; der nächste Versuch braucht ein frisches.
        setCaptchaToken(null);
        setCaptchaNonce((n) => n + 1);
        return;
      }
      setSent(true);
    } finally {
      setLoading(false);
    }
  }

  if (sent) {
    return (
      <div className="card-surface max-w-2xl space-y-3 p-6" role="status">
        <div className="flex h-11 w-11 items-center justify-center rounded-full border border-success/30 bg-success/10">
          <MailCheck className="h-5 w-5 text-success" strokeWidth={1.8} aria-hidden />
        </div>
        <h2 className="text-[20px] font-semibold tracking-[-0.01em] text-foreground">
          Angekommen, danke.
        </h2>
        <p className="text-[15px] leading-[1.6] text-secondary">
          Ich melde mich unter <span className="text-foreground">{email}</span>, meist innerhalb
          weniger Tage, bei einem echten Fehler schneller.
        </p>
        <button
          type="button"
          onClick={() => {
            setMessage("");
            setSent(false);
            setCaptchaToken(null);
            setCaptchaNonce((n) => n + 1);
          }}
          className="text-[14px] text-accent-text underline underline-offset-2"
        >
          Noch eine Nachricht schreiben
        </button>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="card-surface max-w-2xl space-y-4 p-6" noValidate>
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-1.5">
          <label htmlFor="contact-name" className="block text-[13px] font-medium text-foreground">
            Name <span className="font-normal text-tertiary">(freiwillig)</span>
          </label>
          <Input
            id="contact-name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            autoComplete="name"
            maxLength={CONTACT_LIMITS.name}
          />
        </div>
        <div className="space-y-1.5">
          <label htmlFor="contact-email" className="block text-[13px] font-medium text-foreground">
            E-Mail
          </label>
          <Input
            id="contact-email"
            type="email"
            placeholder="du@example.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            autoComplete="email"
            maxLength={CONTACT_LIMITS.email}
            required
          />
        </div>
      </div>

      <div className="space-y-1.5">
        <label htmlFor="contact-topic" className="block text-[13px] font-medium text-foreground">
          Worum geht es?
        </label>
        <select
          id="contact-topic"
          value={topic}
          onChange={(e) => setTopic(e.target.value as ContactTopic)}
          className="h-11 w-full rounded-lg border border-border bg-surface px-3.5 text-sm text-foreground transition-colors duration-200 focus:border-ring focus:outline-hidden input-glow"
        >
          {CONTACT_TOPICS.map((t) => (
            <option key={t} value={t}>
              {CONTACT_TOPIC_LABELS[t]}
            </option>
          ))}
        </select>
      </div>

      {topic === "melden" && (
        <div
          role="note"
          className="rounded-xl border border-accent/30 bg-accent-subtle px-4 py-3 text-[13px] leading-relaxed text-secondary"
        >
          <p className="font-medium text-foreground">Was in einer Meldung stehen sollte</p>
          <ul className="mt-1.5 list-disc space-y-1 pl-5">
            <li>wo du den Inhalt gefunden hast (Adresse oder genaue Stelle),</li>
            <li>warum er deiner Meinung nach rechtswidrig ist,</li>
            <li>deinen Namen, falls du ihn angeben willst (die E-Mail-Adresse brauche ich).</li>
          </ul>
          <p className="mt-1.5">
            Mit dem Absenden bestätigst du, dass deine Angaben nach bestem Wissen und Gewissen richtig
            und vollständig sind. Ich bestätige dir den Eingang per Mail und teile dir meine
            Entscheidung mit. Mehr dazu in der{" "}
            <Link href="/nutzungsrichtlinie" className="text-accent-text underline underline-offset-2">
              Nutzungsrichtlinie
            </Link>
            .
          </p>
        </div>
      )}

      <div className="space-y-1.5">
        <label htmlFor="contact-message" className="block text-[13px] font-medium text-foreground">
          Deine Nachricht
        </label>
        <Textarea
          id="contact-message"
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          maxLength={CONTACT_LIMITS.messageMax}
          rows={6}
          required
        />
        <p className="text-[12px] text-tertiary">
          Schick mir bitte nie dein Passwort oder einen API-Key.
        </p>
      </div>

      {/* Köder für Bots: Menschen sehen und füllen dieses Feld nicht. */}
      <div aria-hidden="true" className="absolute left-[-9999px] h-0 w-0 overflow-hidden">
        <input
          type="text"
          name="website"
          tabIndex={-1}
          autoComplete="off"
          value={trap}
          onChange={(e) => setTrap(e.target.value)}
        />
      </div>

      <TurnstileWidget onToken={handleCaptchaToken} resetSignal={captchaNonce} />

      {error && (
        <div
          role="alert"
          className="rounded-xl border border-destructive/30 bg-destructive/10 px-4 py-2.5 text-[13px] text-destructive"
        >
          {error}
        </div>
      )}

      <button
        type="submit"
        disabled={loading}
        className="group flex h-11 w-full items-center justify-center gap-2 rounded-xl bg-primary font-medium text-primary-foreground transition-colors hover:bg-primary/90 disabled:opacity-60 sm:w-auto sm:px-6"
      >
        {loading ? (
          <Loader2 className="h-4 w-4 animate-spin" aria-label="Wird gesendet" />
        ) : (
          <>
            Nachricht senden
            <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
          </>
        )}
      </button>

      <p className="text-[12px] leading-normal text-tertiary">
        Ich nutze deine Angaben nur, um dir zu antworten. Mehr steht in der{" "}
        <Link href="/datenschutz" className="text-accent-text underline underline-offset-2">
          Datenschutzerklärung
        </Link>
        .
      </p>
    </form>
  );
}
