import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { FadeIn } from "@/components/motion/fade-in";

export const metadata = { title: "Einstellungen" };

export default function SettingsPage() {
  return (
    <div className="max-w-[800px]">
      <FadeIn>
        <h1 className="text-[32px] md:text-[40px] leading-[1.05] tracking-[-0.03em] font-semibold text-white">
          Einstellungen
        </h1>
        <p className="mt-1 text-[14px] text-white/55 mb-10">
          Workspace-, Profil- und Integrations-Konfiguration.
        </p>
      </FadeIn>

      <div className="space-y-6">
        <Section title="Profil" description="Wie du in deinem Workspace erscheinst.">
          <Field label="Anzeigename" id="display-name" placeholder="Dein Name" />
          <Field label="Email" id="email" type="email" placeholder="du@example.com" disabled />
          <div className="pt-2">
            <Button>Änderungen speichern</Button>
          </div>
        </Section>

        <Section
          title="API-Keys"
          description="Eigene Keys nutzen (ab Pro). Wenn gesetzt, werden Generierungen über dein Provider-Konto abgerechnet."
        >
          <Field
            label="Anthropic API-Key"
            id="anthropic"
            type="password"
            placeholder="sk-ant-…"
          />
          <Field label="OpenAI API-Key" id="openai" type="password" placeholder="sk-…" />
          <div className="pt-2">
            <Button>Keys speichern</Button>
          </div>
        </Section>

        <Section title="Standardwerte" description="Beim Start eines neuen Projekts vorausfüllen.">
          <Field label="Standard Master-Ziel" id="default-master" placeholder="Claude" />
          <Field label="Standard Frontend-Ziel" id="default-frontend" placeholder="Lovable" />
          <Field label="Standard Backend-Ziel" id="default-backend" placeholder="Claude Code" />
          <Field label="Standard-Datenbank" id="default-db" placeholder="Supabase" />
          <div className="pt-2">
            <Button>Standardwerte speichern</Button>
          </div>
        </Section>

        <Section title="Gefahrenzone" description="Unwiderrufliche Aktionen.">
          <div className="rounded-lg border border-red-500/25 bg-red-500/[0.04] p-4 flex items-center justify-between">
            <div>
              <div className="text-[14px] font-medium text-white">Konto löschen</div>
              <div className="text-[12.5px] text-white/55">Entfernt alle Projekte und Generierungen.</div>
            </div>
            <Button variant="destructive">Löschen</Button>
          </div>
        </Section>
      </div>
    </div>
  );
}

function Section({
  title,
  description,
  children,
}: {
  title: string;
  description: string;
  children: React.ReactNode;
}) {
  return (
    <div className="card-surface">
      <div className="mb-5">
        <h2 className="text-[16px] font-semibold tracking-tight text-white">{title}</h2>
        <p className="text-[13px] text-white/55 mt-1">{description}</p>
      </div>
      <div className="space-y-4">{children}</div>
    </div>
  );
}

function Field({
  label,
  id,
  ...props
}: { label: string; id: string } & React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <div className="space-y-1.5">
      <Label htmlFor={id}>{label}</Label>
      <Input id={id} {...props} />
    </div>
  );
}
