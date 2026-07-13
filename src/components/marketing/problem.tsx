import { FadeIn } from "@/components/motion/fade-in";
import { AnimatedMascot } from "@/components/brand/animated-mascot";
import { Floaters, type FloaterSpec } from "@/components/brand/floaters";

const pains = [
  "Die leere Seite.",
  "Immer wieder von vorne.",
  "Der Plan bleibt im Kopf.",
];

// A compact, quiet section — just a few drifting sparks, not a full field.
const PROBLEM_FLOATERS: FloaterSpec[] = [
  { kind: "star", top: "8%", left: "88%", size: 11, delay: 0.2, duration: 3.4 },
  { kind: "bubble", top: "40%", left: "94%", size: 15, delay: 0.9, duration: 4.4 },
  { kind: "star", top: "78%", left: "85%", size: 9, delay: 1.4, duration: 3.1 },
];

export function Problem() {
  return (
    <section className="container-x relative overflow-hidden py-16 md:py-24">
      <Floaters items={PROBLEM_FLOATERS} />

      <div className="relative z-10 max-w-2xl">
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
              motion="bob"
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
