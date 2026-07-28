import type { Metadata } from "next";
import Link from "next/link";
import { Navbar } from "@/components/marketing/navbar";
import { Footer } from "@/components/marketing/footer";
import { FadeIn } from "@/components/motion/fade-in";
import { AnimatedMascot } from "@/components/brand/animated-mascot";
import { DOCS_GROUPS, DOCS_ORDER, docHref } from "@/lib/docs-nav";

export const metadata: Metadata = {
  title: "Hilfe",
  description:
    "Alles, was PromptPrinter kann: Chat mit Finn, Projekte, Dateien, eigene API-Keys, Pläne und Limits. Von vorne lesbar oder gezielt nachschlagen.",
};

export default function DocsIndexPage() {
  // Continuous step numbers across groups: the list is one reading path, the
  // group headings only chapter it. Matches the "Schritt n von m" label the
  // articles themselves show.
  let step = 0;

  return (
    <main>
      <Navbar />

      <section
        id="main-content"
        tabIndex={-1}
        className="container-x pt-32 md:pt-40 pb-14 focus:outline-none"
      >
        <FadeIn>
          <div className="flex flex-col gap-8 md:flex-row md:items-center md:justify-between">
            <div className="max-w-2xl">
              <p className="mb-5 text-[11px] font-mono uppercase tracking-[0.08em] text-accent-text">
                Hilfe
              </p>
              <h1 className="text-balance text-[40px] md:text-[56px] leading-[1.05] tracking-[-0.04em] font-semibold text-foreground">
                Wie du das hier <span className="gradient-text">wirklich nutzt.</span>
              </h1>
              <p className="mt-6 text-[17px] leading-[1.6] text-secondary">
                {DOCS_ORDER.length} kurze Kapitel, von der ersten Anmeldung bis zu
                eigenen API-Keys. Lies sie der Reihe nach durch, oder spring direkt
                zu dem, was gerade klemmt.
              </p>
            </div>
            <AnimatedMascot
              state="explaining"
              motion="float"
              size={150}
              className="hidden shrink-0 lg:block"
              alt="Der Delfin erklärt dir die Grundlagen"
            />
          </div>
        </FadeIn>
      </section>

      <section className="container-x pb-24">
        <div className="max-w-3xl space-y-12">
          {DOCS_GROUPS.map((group, gi) => (
            <FadeIn key={group.title} delay={gi * 0.05}>
              <section>
                <h2 className="mb-4 text-[11px] font-mono uppercase tracking-[0.08em] text-tertiary">
                  {group.title}
                </h2>
                <ul className="border-t border-border">
                  {group.articles.map((article) => {
                    step += 1;
                    const n = step;
                    return (
                      <li key={article.slug} className="border-b border-border">
                        <Link
                          href={docHref(article.slug)}
                          className="group flex gap-5 py-5 transition-colors hover:bg-surface/60"
                        >
                          <span className="mt-0.5 w-6 shrink-0 text-[12px] font-mono tabular-nums text-tertiary transition-colors group-hover:text-accent-text">
                            {String(n).padStart(2, "0")}
                          </span>
                          <span className="min-w-0">
                            <span className="block text-[16px] font-medium text-foreground">
                              {article.title}
                            </span>
                            <span className="mt-1 block text-[14px] leading-[1.6] text-secondary">
                              {article.summary}
                            </span>
                          </span>
                        </Link>
                      </li>
                    );
                  })}
                </ul>
              </section>
            </FadeIn>
          ))}

          <FadeIn>
            <p className="text-[14px] text-secondary">
              Etwas nicht gefunden oder etwas stimmt nicht?{" "}
              <Link
                href="/kontakt"
                className="text-accent-text underline underline-offset-2"
              >
                Schreib mir
              </Link>
              , ich nehme es auf.
            </p>
          </FadeIn>
        </div>
      </section>

      <Footer />
    </main>
  );
}
