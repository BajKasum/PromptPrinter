import type { Metadata } from "next";
import Link from "next/link";
import { Navbar } from "@/components/marketing/navbar";
import { Footer } from "@/components/marketing/footer";
import { FadeIn } from "@/components/motion/fade-in";
import { AnimatedMascot } from "@/components/brand/animated-mascot";
import { Button } from "@/components/ui/button";
import { LEGAL } from "@/lib/legal";

export const metadata: Metadata = {
  title: "Über",
  description:
    "Wer hinter PromptPrinter steckt, warum es das gibt und was ich dir verspreche, solange ich es allein baue.",
};

// The one page written in the founder's own voice rather than Finn's. The
// brand rule (marketing copy speaks as Finn) is deliberately suspended here:
// an "about" page in a mascot's voice would hide exactly the thing the page
// exists to show, that there's one actual person behind this.

const PROMISES = [
  {
    title: "Keine Werbung",
    body: "Nirgends. Kein Banner, kein gesponserter Hinweis, kein Tracking-Pixel, den ich an jemanden verkaufe. Wenn ein Werkzeug beim Denken helfen soll, darf es dich nicht gleichzeitig ablenken wollen.",
  },
  {
    title: "Der Free-Plan ist echt gemeint",
    body: "Mit deinem eigenen API-Key kostet dich PromptPrinter nichts, dauerhaft, nicht 14 Tage. Du zahlst die Modellnutzung ohnehin schon bei deinem Anbieter, da muss ich nicht nochmal die Hand aufhalten.",
  },
  {
    title: "Ich sage, was es nicht kann",
    body: "Das hier ist Beta, von einer Person gebaut. Es gibt keine Rufbereitschaft und keine Verfügbarkeitsgarantie. Was fehlt, steht in der Hilfe, statt dass ich es im Marketing wegblende.",
  },
];

export default function UeberPage() {
  return (
    <main>
      <Navbar />

      <section
        id="main-content"
        tabIndex={-1}
        className="container-x pt-32 md:pt-40 pb-4 focus:outline-none"
      >
        <FadeIn>
          <div className="flex flex-col gap-10 md:flex-row md:items-center md:justify-between">
            <div className="max-w-2xl">
              <p className="mb-5 text-[11px] font-mono uppercase tracking-[0.08em] text-accent-text">
                Über PromptPrinter
              </p>
              <h1 className="text-balance text-[40px] md:text-[58px] leading-[1.05] tracking-[-0.04em] font-semibold text-foreground">
                Eine Person, ein Delfin,{" "}
                <span className="gradient-text">ein ziemlich konkreter Ärger.</span>
              </h1>
            </div>
            <AnimatedMascot
              state="welcoming"
              motion="float"
              size={160}
              className="hidden shrink-0 lg:block"
              alt="Der Delfin Finn winkt"
            />
          </div>
        </FadeIn>
      </section>

      <section className="container-x pb-20">
        <FadeIn>
          <div className="max-w-2xl text-[16px] leading-[1.75] text-foreground/70 [&_a]:text-accent-text [&_a]:underline [&_a]:underline-offset-2 [&_p]:mb-5">
            <p>
              Ich heisse Kasum, ich lerne Informatik in Basel, und PromptPrinter
              ist mein erstes eigenes Produkt. Kein Team, keine Investoren, kein
              Büro. Abende und Wochenenden.
            </p>
            <p>
              Angefangen hat es mit einer Beobachtung an mir selbst. Ich habe mit
              Lovable, Cursor und Claude Code gebaut und dabei jedes Mal
              denselben Fehler gemacht: Ich tippe drei Sätze, drücke Enter, und
              das Tool legt sofort los. Es fragt nicht, welche Datenbank ich
              will. Es fragt nicht, ob es Login geben soll. Es fragt gar nichts,
              es <em>rät</em>. Und wenn es falsch rät, merke ich das erst am
              Ergebnis und darf die Runde nochmal drehen. Jede dieser Runden
              kostet Credits.
            </p>
            <p>
              Das Ärgerliche daran: Die fehlenden Angaben hätte ich alle liefern
              können. Mich hat nur niemand gefragt.
            </p>
            <p>
              Genau das macht Finn. Er ist der Delfin, mit dem du hier redest,
              und sein ganzer Job besteht darin, einmal ordentlich nachzufragen,
              bevor du den Prompt in dein Bau-Tool kippst. Eine gebündelte
              Rückfrage: Ziel-Tool, die wichtigsten Screens, was gespeichert
              wird, ob es Konten gibt, wie es aussehen soll. Danach bekommst du
              einen Prompt, der für sich steht.
            </p>
            <p>
              Das ist kein grosses technisches Kunststück. Es ist der Schritt,
              den man überspringt, weil man es eilig hat, und der einen genau
              deswegen Zeit kostet.
            </p>
          </div>
        </FadeIn>
      </section>

      <section className="container-x pb-20">
        <FadeIn>
          <h2 className="mb-8 text-[26px] md:text-[32px] leading-[1.15] tracking-[-0.02em] font-semibold text-foreground">
            Was ich dir verspreche
          </h2>
          <div className="grid max-w-4xl gap-4 md:grid-cols-3">
            {PROMISES.map((p, i) => (
              <FadeIn key={p.title} delay={i * 0.07}>
                <div className="card-surface h-full p-5">
                  <h3 className="text-[15px] font-semibold text-foreground">
                    {p.title}
                  </h3>
                  <p className="mt-2 text-[14px] leading-[1.6] text-foreground/60">
                    {p.body}
                  </p>
                </div>
              </FadeIn>
            ))}
          </div>
        </FadeIn>
      </section>

      <section className="container-x pb-24">
        <FadeIn>
          <div className="max-w-2xl text-[16px] leading-[1.75] text-foreground/70 [&_a]:text-accent-text [&_a]:underline [&_a]:underline-offset-2 [&_p]:mb-5">
            <h2 className="mb-4 text-[26px] md:text-[32px] leading-[1.15] tracking-[-0.02em] font-semibold text-foreground">
              Wenn etwas kaputt ist
            </h2>
            <p>
              Dann schreib mir. Bei einem Solo-Projekt ist das kein
              Support-Ticket in einer Warteschlange, sondern eine E-Mail, die auf
              meinem Handy landet. Ich kann keine Antwortzeit garantieren, aber
              Fehler nehme ich ernst und meistens schneller ernst als jedes
              Ticket-System.
            </p>
            <p>
              <Link href="/kontakt">Kontaktseite</Link>, oder direkt an{" "}
              <a href={`mailto:${LEGAL.email}`}>{LEGAL.email}</a>.
            </p>
          </div>
        </FadeIn>

        <FadeIn>
          <div className="mt-10 flex flex-wrap gap-3">
            <Button asChild variant="primary">
              <Link href="/signup">Ausprobieren</Link>
            </Button>
            <Button asChild variant="ghost">
              <Link href="/docs">Erst die Hilfe lesen</Link>
            </Button>
          </div>
        </FadeIn>
      </section>

      <Footer />
    </main>
  );
}
