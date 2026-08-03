import type { Metadata } from "next";
import Link from "next/link";
import { Bug, HelpCircle, Lightbulb, ShieldCheck } from "lucide-react";
import { FadeIn } from "@/shared/motion/fade-in";
import { AnimatedMascot } from "@/shared/brand/animated-mascot";
import { LEGAL } from "@/shared/lib/legal";

export const metadata: Metadata = {
  title: "Kontakt",
  description:
    "Fehler melden, Fragen stellen, Datenschutzanfragen: alles läuft über eine E-Mail-Adresse, ohne Ticket-System.",
};

// Deliberately no contact form: the project has no transactional mail setup,
// so a form would either silently drop messages or need a whole delivery
// stack for one address. A plain mailto is honest and works today.

const TOPICS = [
  {
    icon: Bug,
    title: "Etwas ist kaputt",
    body: "Fehler, hängende Antworten, etwas sieht falsch aus. Das hat Vorrang vor allem anderen.",
    subject: "Fehler in PromptPrinter",
  },
  {
    icon: HelpCircle,
    title: "Ich komme nicht weiter",
    body: "Etwas verhält sich anders als erwartet. Ein Blick in die Hilfe lohnt sich zuerst, danach frag einfach.",
    subject: "Frage zu PromptPrinter",
  },
  {
    icon: Lightbulb,
    title: "Mir fehlt etwas",
    body: "Wünsche und Ideen sind willkommen. Ich verspreche keine Umsetzung, aber ich lese jede einzelne.",
    subject: "Idee für PromptPrinter",
  },
  {
    icon: ShieldCheck,
    title: "Daten und Rechtliches",
    body: "Auskunft, Berichtigung oder Löschung deiner Daten, oder Fragen zu den Rechtstexten.",
    subject: "Datenschutzanfrage",
  },
];

export default function KontaktPage() {
  return (
    <>

      <section
        id="main-content"
        tabIndex={-1}
        className="container-x pt-32 md:pt-40 pb-12 focus:outline-none"
      >
        <FadeIn>
          <div className="flex flex-col gap-10 md:flex-row md:items-center md:justify-between">
            <div className="max-w-2xl">
              <p className="mb-5 text-[11px] font-mono uppercase tracking-[0.08em] text-accent-text">
                Kontakt
              </p>
              <h1 className="text-balance text-[40px] md:text-[58px] leading-[1.05] tracking-[-0.04em] font-semibold text-foreground">
                Schreib mir einfach.
              </h1>
              <p className="mt-6 text-[17px] leading-[1.6] text-secondary">
                Kein Ticket-System, keine Warteschlange, keine
                Chatbot-Schleife. Deine Mail landet direkt bei mir.
              </p>
              <a
                href={`mailto:${LEGAL.email}`}
                className="mt-7 inline-flex items-center rounded-xl border border-border-strong bg-surface-raised px-4 py-3 text-[15px] font-medium text-foreground transition-colors hover:bg-surface-hover focus-glow"
              >
                {LEGAL.email}
              </a>
            </div>
            <AnimatedMascot
              state="listening"
              motion="lean"
              size={150}
              className="hidden shrink-0 lg:block"
              alt="Der Delfin hört zu"
            />
          </div>
        </FadeIn>
      </section>

      <section className="container-x pb-16">
        <FadeIn>
          <div className="grid max-w-4xl gap-4 sm:grid-cols-2">
            {TOPICS.map((t, i) => {
              const Icon = t.icon;
              return (
                <FadeIn key={t.title} delay={i * 0.06}>
                  <a
                    href={`mailto:${LEGAL.email}?subject=${encodeURIComponent(t.subject)}`}
                    className="card-surface block h-full p-5 transition-colors focus-glow"
                  >
                    <Icon
                      className="h-5 w-5 text-accent-text"
                      strokeWidth={1.8}
                      aria-hidden
                    />
                    <h2 className="mt-3 text-[15px] font-semibold text-foreground">
                      {t.title}
                    </h2>
                    <p className="mt-1.5 text-[14px] leading-[1.6] text-secondary">
                      {t.body}
                    </p>
                  </a>
                </FadeIn>
              );
            })}
          </div>
        </FadeIn>
      </section>

      <section className="container-x pb-24">
        <FadeIn>
          <div className="max-w-2xl text-[15px] leading-[1.7] text-foreground/70 [&_a]:text-accent-text [&_a]:underline [&_a]:underline-offset-2 [&_li]:marker:text-tertiary [&_p]:mb-4 [&_ul]:mb-4 [&_ul]:list-disc [&_ul]:space-y-1.5 [&_ul]:pl-5">
            <h2 className="mb-3 text-[20px] font-semibold tracking-[-0.01em] text-foreground">
              Bei einem Fehler hilft mir das
            </h2>
            <p>
              Je mehr davon in der Mail steht, desto eher ist es am selben Abend
              behoben:
            </p>
            <ul>
              <li>Was wolltest du tun, und was ist stattdessen passiert?</li>
              <li>Auf welcher Seite, und ungefähr wann?</li>
              <li>Browser und Gerät, grob reicht.</li>
              <li>Ein Screenshot, falls man es sehen kann.</li>
            </ul>
            <p>
              <strong className="font-medium text-foreground/90">
                Schick mir bitte nie dein Passwort oder einen API-Key.
              </strong>{" "}
              Ich brauche beides nie, um ein Problem nachzuvollziehen.
            </p>

            <h2 className="mb-3 mt-10 text-[20px] font-semibold tracking-[-0.01em] text-foreground">
              Wie lange es dauert
            </h2>
            <p>
              PromptPrinter ist ein Solo-Projekt neben Schule und Alltag. Ich
              kann keine feste Antwortzeit zusagen. In der Praxis melde ich mich
              meist innerhalb weniger Tage, bei einem echten Fehler schneller.
            </p>

            <h2 className="mb-3 mt-10 text-[20px] font-semibold tracking-[-0.01em] text-foreground">
              Vielleicht steht die Antwort schon da
            </h2>
            <p>
              Ein kurzer Blick in die <Link href="/docs">Hilfe</Link> spart euch
              beiden eine Runde, besonders bei Fragen zu{" "}
              <Link href="/docs/plaene-und-limits">Limits</Link> und{" "}
              <Link href="/docs/eigene-api-keys">eigenen API-Keys</Link>. Zum
              Thema Erstattung gibt es die{" "}
              <Link href="/rueckerstattung">Rückerstattungsrichtlinie</Link>.
            </p>

            <h2 className="mb-3 mt-10 text-[20px] font-semibold tracking-[-0.01em] text-foreground">
              Anbieter
            </h2>
            <p>
              {LEGAL.operator}
              <br />
              {LEGAL.postalCity}, {LEGAL.country}
              <br />
              Vollständige Angaben im <Link href="/impressum">Impressum</Link>.
            </p>
          </div>
        </FadeIn>
      </section>

    </>
  );
}
