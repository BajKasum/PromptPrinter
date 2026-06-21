import { FadeIn, StaggerChildren, StaggerItem } from "@/components/motion/fade-in";
import { Pencil, MessageSquare, PackageCheck } from "lucide-react";
import { AnimatedMascot } from "@/components/brand/animated-mascot";

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
    <section className="container-x py-24 md:py-32 relative">
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

      <StaggerChildren className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {steps.map(({ n, Icon, title, body, chat }) => (
          <StaggerItem key={n}>
            <div className="card-surface h-full relative group overflow-hidden p-6 flex flex-col">
              <div className="absolute top-5 right-5 font-mono text-[11px] tracking-[0.08em] text-foreground/35">
                {n}
              </div>
              <div className="h-10 w-10 rounded-lg bg-surface border border-border flex items-center justify-center mb-5">
                <Icon className="h-5 w-5 text-foreground/85" strokeWidth={1.8} />
              </div>
              <h3 className="text-[17px] font-semibold tracking-tight text-foreground mb-2">
                {title}
              </h3>
              <p className="text-[14px] leading-[1.6] text-foreground/55">{body}</p>

              {/* Step 2 shows the real conversational feel — same baby-blue
                  user bubble as the app. */}
              {chat && (
                <div className="mt-5 space-y-2.5">
                  <div className="max-w-[88%] rounded-2xl rounded-bl-sm border border-border bg-surface px-3.5 py-2 text-[12.5px] leading-relaxed text-foreground/70">
                    Welche Datenbank nutzt du — und brauchst du von Anfang an Login?
                  </div>
                  <div className="ml-auto max-w-[88%] rounded-2xl rounded-br-sm border border-accent/30 bg-accent-subtle px-3.5 py-2 text-[12.5px] leading-relaxed text-foreground">
                    Supabase, und ja — E-Mail plus Google.
                  </div>
                </div>
              )}
            </div>
          </StaggerItem>
        ))}
      </StaggerChildren>
    </section>
  );
}
