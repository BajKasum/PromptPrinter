import { FadeIn, StaggerChildren, StaggerItem } from "@/components/motion/fade-in";
import {
  MessageSquare,
  Code2,
  FolderKanban,
  Library,
  Download,
  Command,
  Sparkles,
  SunMoon,
} from "lucide-react";

// The actual product capabilities (what you can *do*), distinct from the
// artifacts grid below (what you *get*). Bento layout — varied tile sizes,
// deliberately not a uniform card grid.

function TileShell({
  className = "",
  Icon,
  title,
  children,
}: {
  className?: string;
  Icon: typeof MessageSquare;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <StaggerItem className={className}>
      <div className="card-surface h-full p-6 flex flex-col transition-colors duration-300 hover:border-border-strong">
        <div className="mb-5 flex h-10 w-10 items-center justify-center rounded-lg border border-accent/25 bg-accent-subtle">
          <Icon className="h-[18px] w-[18px] text-accent-text" strokeWidth={1.8} />
        </div>
        <h3 className="text-[16px] font-semibold tracking-tight text-foreground mb-1.5">
          {title}
        </h3>
        <div className="text-[14px] leading-[1.6] text-foreground/55">{children}</div>
      </div>
    </StaggerItem>
  );
}

export function Capabilities() {
  return (
    <section id="funktionen" className="scroll-mt-24 container-x py-24 md:py-32">
      <FadeIn>
        <div className="max-w-2xl mb-14">
          <div className="text-[11px] font-mono uppercase tracking-[0.08em] text-accent-text mb-4">
            Funktionen
          </div>
          <h2 className="text-balance text-[36px] md:text-[48px] leading-[1.1] tracking-[-0.03em] font-semibold text-foreground">
            Nicht nur ein Generator. Ein Arbeitsplatz.
          </h2>
          <p className="mt-4 text-[17px] text-foreground/55 max-w-xl">
            Vom ersten Satz bis zum exportierten Packet bleibt alles an einem Ort,
            durchsuchbar und tastatur-schnell.
          </p>
        </div>
      </FadeIn>

      <StaggerChildren
        staggerChildren={0.05}
        className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-6 gap-4 lg:auto-rows-fr"
      >
        {/* Hero tile — the core interaction */}
        <StaggerItem className="md:col-span-2 lg:col-span-3 lg:row-span-2">
          <div className="card-surface h-full p-6 md:p-8 flex flex-col transition-colors duration-300 hover:border-border-strong">
            <div className="mb-5 flex h-10 w-10 items-center justify-center rounded-lg border border-accent/25 bg-accent-subtle">
              <MessageSquare className="h-[18px] w-[18px] text-accent-text" strokeWidth={1.8} />
            </div>
            <h3 className="text-[20px] font-semibold tracking-tight text-foreground mb-2">
              Bau im Gespräch
            </h3>
            <p className="text-[15px] leading-[1.65] text-foreground/55 max-w-md">
              Kein Formular, kein Wizard. Du beschreibst dein Ziel, PromptPrinter fragt
              gezielt nach und schärft mit dir Schritt für Schritt, bis der Prompt sitzt.
            </p>

            {/* Mini chat echo — same baby blue user bubble as the real app */}
            <div className="mt-6 lg:mt-auto space-y-2.5 pt-6">
              <div className="max-w-[78%] rounded-2xl rounded-bl-sm border border-border bg-surface px-3.5 py-2 text-[12.5px] leading-relaxed text-foreground/70">
                Welche Datenbank nutzt du, und brauchst du Auth von Anfang an?
              </div>
              <div className="ml-auto max-w-[78%] rounded-2xl rounded-br-sm border border-accent/30 bg-accent-subtle px-3.5 py-2 text-[12.5px] leading-relaxed text-foreground">
                Supabase, und ja, E-Mail plus Google.
              </div>
            </div>
          </div>
        </StaggerItem>

        <TileShell className="lg:col-span-3" Icon={Code2} title="Zwei Modi">
          <p>Prompt Chat für allgemeine Prompts, Prompt Code für komplette Software-Packets.</p>
          <div className="mt-3 flex flex-wrap gap-1.5">
            <span className="rounded-full border border-border bg-surface px-2.5 py-1 font-mono text-[10.5px] uppercase tracking-[0.08em] text-foreground/70">
              Prompt Chat
            </span>
            <span className="rounded-full border border-border bg-surface px-2.5 py-1 font-mono text-[10.5px] uppercase tracking-[0.08em] text-foreground/70">
              Prompt Code
            </span>
          </div>
        </TileShell>

        <TileShell className="lg:col-span-3" Icon={FolderKanban} title="Projekt-Workspace">
          <p>
            Jedes Build-Packet wird gespeichert, organisiert und mit einem Stern als
            Favorit markierbar.
          </p>
        </TileShell>

        <TileShell className="lg:col-span-2" Icon={Library} title="Bibliothek">
          <p>Alle erzeugten Prompts an einem Ort, durchsuchbar und sofort wieder nutzbar.</p>
        </TileShell>

        <TileShell className="lg:col-span-2" Icon={Download} title="Markdown-Export">
          <p>Kopiere jedes Artefakt einzeln oder lade das ganze Packet als Bundle.</p>
        </TileShell>

        <TileShell className="lg:col-span-2" Icon={Command} title="Befehls-Palette">
          <p>
            Überall hinspringen, ohne die Hände von der Tastatur zu nehmen.
          </p>
          <div className="mt-3 inline-flex items-center gap-1 font-mono text-[10.5px] text-foreground/55">
            <kbd className="rounded border border-border bg-surface px-1.5 py-0.5">⌘</kbd>
            <kbd className="rounded border border-border bg-surface px-1.5 py-0.5">K</kbd>
          </div>
        </TileShell>

        <TileShell className="lg:col-span-3" Icon={Sparkles} title="Im Chat verfeinern">
          <p>Nimm ein Projekt jederzeit wieder auf und iteriere im selben Gespräch weiter.</p>
        </TileShell>

        <TileShell className="lg:col-span-3" Icon={SunMoon} title="Light & Dark">
          <p>Heller oder dunkler Modus per Toggle, die ganze App passt sich an.</p>
        </TileShell>
      </StaggerChildren>
    </section>
  );
}
