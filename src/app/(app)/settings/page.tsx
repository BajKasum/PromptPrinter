import { redirect } from "next/navigation";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { FadeIn } from "@/components/motion/fade-in";
import { ProfileForm } from "@/components/app/profile-form";
import { createClient } from "@/lib/supabase/server";

export const metadata = { title: "Einstellungen" };

// Always reflect the latest stored profile, never a cached snapshot.
export const dynamic = "force-dynamic";

export default async function SettingsPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: profile } = await supabase
    .from("profiles")
    .select("display_name")
    .eq("id", user.id)
    .maybeSingle();

  const email = user.email ?? "";
  const displayName = profile?.display_name ?? email.split("@")[0] ?? "";

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
          <ProfileForm userId={user.id} email={email} initialDisplayName={displayName} />
        </Section>

        <Section
          title="API-Keys"
          description="Eigene Keys nutzen (ab Pro). Wenn gesetzt, werden Generierungen über dein Provider-Konto abgerechnet."
          badge="Bald"
        >
          <Field
            label="Anthropic API-Key"
            id="anthropic"
            type="password"
            placeholder="sk-ant-…"
            disabled
          />
          <Field label="OpenAI API-Key" id="openai" type="password" placeholder="sk-…" disabled />
          <div className="pt-2">
            <Button disabled>Keys speichern</Button>
          </div>
        </Section>

        <Section
          title="Standardwerte"
          description="Beim Start eines neuen Projekts vorausfüllen."
          badge="Bald"
        >
          <Field label="Standard Master-Ziel" id="default-master" placeholder="Claude" disabled />
          <Field
            label="Standard Frontend-Ziel"
            id="default-frontend"
            placeholder="Lovable"
            disabled
          />
          <Field
            label="Standard Backend-Ziel"
            id="default-backend"
            placeholder="Claude Code"
            disabled
          />
          <Field label="Standard-Datenbank" id="default-db" placeholder="Supabase" disabled />
          <div className="pt-2">
            <Button disabled>Standardwerte speichern</Button>
          </div>
        </Section>

        <Section title="Gefahrenzone" description="Unwiderrufliche Aktionen." badge="Bald">
          <div className="rounded-lg border border-red-500/25 bg-red-500/[0.04] p-4 flex items-center justify-between">
            <div>
              <div className="text-[14px] font-medium text-white">Konto löschen</div>
              <div className="text-[12.5px] text-white/55">
                Entfernt alle Projekte und Generierungen.
              </div>
            </div>
            <Button variant="destructive" disabled>
              Löschen
            </Button>
          </div>
        </Section>
      </div>
    </div>
  );
}

function Section({
  title,
  description,
  badge,
  children,
}: {
  title: string;
  description: string;
  badge?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="card-surface">
      <div className="mb-5 flex items-start justify-between gap-3">
        <div>
          <h2 className="text-[16px] font-semibold tracking-tight text-white">{title}</h2>
          <p className="text-[13px] text-white/55 mt-1">{description}</p>
        </div>
        {badge && (
          <span className="shrink-0 text-[9px] font-mono uppercase tracking-[0.08em] px-1.5 py-0.5 rounded-full border border-white/[0.08] bg-white/[0.03] text-white/45">
            {badge}
          </span>
        )}
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
