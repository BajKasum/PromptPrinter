import { FadeIn } from "@/components/motion/fade-in";
import { AnimatedMascot } from "@/components/brand/animated-mascot";

const pains = [
  "Die leere Seite.",
  "Immer wieder von vorne.",
  "Der Plan bleibt im Kopf.",
];

export function Problem() {
  return (
    <section className="container-x py-16 md:py-24">
      <div className="max-w-2xl">
        <FadeIn>
          <h2 className="text-balance text-[36px] md:text-[48px] leading-[1.1] tracking-[-0.03em] font-semibold text-foreground">
            Eine Idee zu haben ist leicht.
            <br />
            Anzufangen ist die Hölle.
          </h2>
        </FadeIn>

        <div className="mt-10 flex items-end gap-10">
          <ul className="space-y-3">
            {pains.map((line, i) => (
              <FadeIn key={line} delay={0.12 + i * 0.1}>
                <li className="text-[19px] md:text-[21px] leading-snug tracking-tight text-foreground/45">
                  {line}
                </li>
              </FadeIn>
            ))}
          </ul>

          <FadeIn delay={0.5}>
            <AnimatedMascot
              state="sad"
              size={96}
              className="hidden shrink-0 md:block"
              alt="Der Delfin kennt das Gefühl"
            />
          </FadeIn>
        </div>
      </div>
    </section>
  );
}
