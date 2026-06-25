import { FadeIn, StaggerChildren, StaggerItem } from "@/components/motion/fade-in";
import { Pencil, MessageSquare, PackageCheck } from "lucide-react";
import { AnimatedMascot } from "@/components/brand/animated-mascot";
import { cn } from "@/lib/utils";

const steps = [
  {
    n: "01",
    Icon: Pencil,
    title: "Erzähl mir deine Idee",
    body: "Sag mir in einem Satz, was du bauen willst — egal wie grob. Ein paar Notizen reichen. Ich hol dich da ab, wo du gerade stehst.",
  },
  {
    n: "02",
    Icon: MessageSquare,
    title: "Wir klären es kurz",
    body: "Ich stell dir ein paar einfache Fragen — und helf dir auch, wenn du Zielgruppe oder Technik noch gar nicht kennst.",
    chat: true,
  },
  {
    n: "03",
    Icon: PackageCheck,
    title: "Du bekommst alles, startklar",
    body: "Du bekommst einen kompletten Plan plus die fertigen Anweisungen für jedes KI-Tool. Ein Klick, kopiert — und du legst los.",
  },
];

export function HowItWorks() {
  return (
    <section className="container-x pt-16 md:pt-20 pb-24 md:pb-32 relative">
      <FadeIn>
        <div className="mb-14 flex flex-col gap-8 md:flex-row md:items-center md:justify-between">
          <div className="max-w-2xl">
            <div className="text-[11px] font-mono uppercase tracking-[0.08em] text-accent-text mb-4">
              So gehen wir vor
            </div>
            <h2 className="text-balance text-[36px] md:text-[48px] leading-[1.1] tracking-[-0.03em] font-semibold text-foreground">
              In drei Schritten von der Idee zum fertigen Plan.
            </h2>
            <p className="mt-4 text-[17px] text-foreground/55 max-w-xl">
              Kein Formular, kein Fachchinesisch. Du redest ganz normal — um den
              Rest kümmere ich mich.
            </p>
          </div>
          {/* The dolphin guides you through the process. */}
          <AnimatedMascot
            state="building"
            size={200}
            className="mx-auto shrink-0 md:mx-0"
            alt="Der Delfin führt dich durch die drei Schritte"
          />
        </div>
      </FadeIn>

      {/* A vertical step rail — a sequence, not three parallel cards. The
          connecting line makes the "one → two → three" journey literal. */}
      <StaggerChildren className="mx-auto max-w-3xl">
        {steps.map(({ n, Icon, title, body, chat }, i) => {
          const last = i === steps.length - 1;
          return (
            <StaggerItem key={n}>
              <div className="flex gap-5 md:gap-6">
                {/* Rail: icon node + line that grows to meet the next node */}
                <div className="flex flex-col items-center">
                  <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-border bg-surface">
                    <Icon className="h-5 w-5 text-foreground/85" strokeWidth={1.8} />
                  </div>
                  {!last && <span aria-hidden className="mt-2 w-px grow bg-border" />}
                </div>

                {/* Content */}
                <div className={cn("pt-1.5", last ? "pb-0" : "pb-12")}>
                  <div className="mb-1.5 font-mono text-[11px] tracking-[0.12em] text-foreground/35">
                    Schritt {n}
                  </div>
                  <h3 className="mb-2 text-[18px] font-semibold tracking-tight text-foreground">
                    {title}
                  </h3>
                  <p className="max-w-xl text-[14.5px] leading-[1.6] text-foreground/55">{body}</p>

                  {/* Step 2 shows the real conversational feel — same baby-blue
                      user bubble as the app. */}
                  {chat && (
                    <div className="mt-4 space-y-2.5">
                      <div className="max-w-[88%] rounded-2xl rounded-bl-sm border border-border bg-surface px-3.5 py-2 text-[12.5px] leading-relaxed text-foreground/70">
                        Welche Datenbank nutzt du — und brauchst du von Anfang an Login?
                      </div>
                      <div className="ml-auto max-w-[88%] rounded-2xl rounded-br-sm border border-accent/30 bg-accent-subtle px-3.5 py-2 text-[12.5px] leading-relaxed text-foreground">
                        Supabase, und ja — E-Mail plus Google.
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </StaggerItem>
          );
        })}
      </StaggerChildren>
    </section>
  );
}
