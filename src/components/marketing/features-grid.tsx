import { FadeIn, StaggerChildren, StaggerItem } from "@/components/motion/fade-in";
import {
  MessagesSquare,
  Copy,
  Target,
  FolderKanban,
  KeyRound,
  Clock,
} from "lucide-react";
import { AnimatedMascot } from "@/components/brand/animated-mascot";

// Benefit-first, and grounded in what actually happens in a chat with Finn
// (src/prompts/system.ts's CHAT_SYSTEM_PROMPT): a bundled clarifying question
// covering only what this idea needs, then the finished prompt in the
// conversation, not a set of auto-generated documents.
const features = [
  {
    Icon: MessagesSquare,
    title: "Ich frag nach, bis es passt",
    body: "Statt zu raten, hak ich kurz nach, Zielgruppe, Ton, das Wichtigste, bevor der Prompt fertig ist.",
  },
  {
    Icon: Copy,
    title: "Dein fertiger Prompt",
    body: "Ausformuliert, direkt im Chat, mit einem Klick kopiert und sofort einsatzbereit.",
  },
  {
    Icon: Target,
    title: "Zugeschnitten auf dein Tool",
    body: "Sag mir, ob's für Claude, ChatGPT, Lovable oder Cursor ist, ich pass die Wortwahl darauf an.",
  },
  {
    Icon: FolderKanban,
    title: "Projekte als Arbeitsplatz",
    body: "Mehrere Chats, eigene Dateien und Notizen an einem Ort, statt jedes Mal neu zu erklären.",
  },
  {
    Icon: KeyRound,
    title: "Dein eigener KI-Key",
    body: "Hinterleg deinen Anthropic-, OpenAI- oder Gemini-Key in den Einstellungen und zahl nur, was du wirklich brauchst.",
  },
  {
    Icon: Clock,
    title: "Nichts geht verloren",
    body: "Jedes Gespräch bleibt gespeichert, jederzeit weiterführen oder nochmal nachlesen.",
  },
];

export function FeaturesGrid() {
  return (
    <section id="funktionen" className="scroll-mt-24 container-x py-24 md:py-32">
      <FadeIn>
        <div className="mb-14 flex flex-col gap-8 md:flex-row md:items-center md:justify-between">
          <div className="max-w-2xl">
            <div className="text-[11px] font-mono uppercase tracking-[0.08em] text-accent-text mb-4">
              Das bekommst du von mir
            </div>
            <h2 className="text-balance text-[36px] md:text-[48px] leading-[1.1] tracking-[-0.03em] font-semibold text-foreground">
              Eine Idee rein. Ein fertiger Prompt raus.
            </h2>
            <p className="mt-4 text-[17px] text-secondary max-w-xl">
              Kein Rätselraten mehr, was du der KI sagen sollst. Ich frag nach,
              bis ich es genau weiss, dann schreib ich es für dich auf.
            </p>
          </div>
          {/* Finn brings your scattered idea into one clear shape. */}
          <AnimatedMascot
            state="organizing"
            size={160}
            className="hidden shrink-0 md:block"
            alt="Der Delfin bringt deine Idee in Form"
          />
        </div>
      </FadeIn>

      <StaggerChildren
        staggerChildren={0.04}
        className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4"
      >
        {features.map(({ Icon, title, body }) => (
          <StaggerItem key={title}>
            <div className="card-surface h-full p-6 group">
              <div className="h-10 w-10 rounded-lg bg-surface border border-border flex items-center justify-center mb-5 group-hover:bg-surface-hover transition-colors duration-300">
                <Icon className="h-5 w-5 text-foreground/85" strokeWidth={1.8} />
              </div>
              <h3 className="text-[16px] font-semibold tracking-tight text-foreground mb-1.5">
                {title}
              </h3>
              <p className="text-[14px] leading-[1.6] text-secondary">{body}</p>
            </div>
          </StaggerItem>
        ))}
      </StaggerChildren>
    </section>
  );
}
