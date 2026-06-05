"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";
import {
  User,
  Building2,
  Gauge,
  KeyRound,
  Lock,
  Sparkles,
  LayoutTemplate,
  TerminalSquare,
  Database,
  ShieldAlert,
  ArrowUpRight,
  Loader2,
  Check,
  type LucideIcon,
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/toast";
import { ToolPickerGroup } from "@/components/app/tool-picker";
import { DeleteAccount } from "@/components/app/delete-account";
import { ChangePassword } from "@/components/app/change-password";
import { AvatarUpload } from "@/components/app/avatar-upload";
import { ToolLogo } from "@/components/brand/tool-logos";
import { TOOL_OPTIONS, type ProjectTools } from "@/lib/tools";
import { createClient } from "@/lib/supabase/client";
import { cn } from "@/lib/utils";

type PlanKey = "free" | "pro" | "team";

type Usage = {
  projects: number;
  projectLimit: number;
  generations: number;
  generationLimit: number;
};

const PLAN_BADGE: Record<PlanKey, string> = {
  free: "border-white/15 bg-white/[0.06] text-white/70",
  pro: "border-violet-400/40 bg-violet-500/15 text-violet-200",
  team: "border-cyan-400/40 bg-cyan-500/15 text-cyan-200",
};

export function SettingsWorkspace({
  userId,
  email,
  initialDisplayName,
  initialAvatarUrl,
  initialTools,
  baseSettings,
  plan,
  usage,
  memberSince,
}: {
  userId: string;
  email: string;
  initialDisplayName: string;
  initialAvatarUrl: string | null;
  initialTools: ProjectTools;
  baseSettings: Record<string, unknown> | null;
  plan: PlanKey;
  usage: Usage;
  memberSince: string | null;
}) {
  const router = useRouter();
  const { toast } = useToast();

  // Current edits vs. the saved baseline. The baseline advances on a successful
  // save so the dirty state (and the save bar) reset without a full reload.
  const [displayName, setDisplayName] = useState(initialDisplayName);
  const [tools, setTools] = useState<ProjectTools>(initialTools);
  const [baseName, setBaseName] = useState(initialDisplayName);
  const [baseTools, setBaseTools] = useState<ProjectTools>(initialTools);
  const [saving, setSaving] = useState(false);

  const nameTrimmed = displayName.trim();
  const nameDirty = nameTrimmed !== baseName.trim();
  const nameValid = nameTrimmed.length > 0;
  // Compare trimmed against the (already-trimmed) baseline so trailing spaces in
  // a custom entry don't register as a phantom change.
  const toolsDirty =
    tools.master.trim() !== baseTools.master ||
    tools.frontend.trim() !== baseTools.frontend ||
    tools.backend.trim() !== baseTools.backend ||
    tools.database.trim() !== baseTools.database;
  // A custom tool the user left blank can't be saved.
  const toolsValid =
    tools.master.trim().length > 0 &&
    tools.frontend.trim().length > 0 &&
    tools.backend.trim().length > 0 &&
    tools.database.trim().length > 0;
  const dirty = nameDirty || toolsDirty;
  const canSave = dirty && !saving && !(nameDirty && !nameValid) && toolsValid;

  function cancel() {
    setDisplayName(baseName);
    setTools(baseTools);
  }

  async function save() {
    if (!canSave) return;
    setSaving(true);

    // Persist trimmed tool names so stray whitespace never reaches storage.
    const cleanTools: ProjectTools = {
      master: tools.master.trim(),
      frontend: tools.frontend.trim(),
      backend: tools.backend.trim(),
      database: tools.database.trim(),
    };

    const patch: Record<string, unknown> = {};
    if (nameDirty && nameValid) patch.display_name = nameTrimmed;
    if (toolsDirty) patch.settings = { ...(baseSettings ?? {}), defaultTools: cleanTools };

    const supabase = createClient();
    const { error } = await supabase.from("profiles").update(patch).eq("id", userId);
    setSaving(false);

    if (error) {
      toast({
        title: "Konnte nicht gespeichert werden",
        description: "Bitte versuche es erneut.",
        variant: "error",
      });
      return;
    }

    // Advance the baseline to the just-saved (trimmed) values so the bar slides
    // away and the visible fields reflect exactly what was stored.
    setDisplayName(nameTrimmed);
    setBaseName(nameTrimmed);
    setTools(cleanTools);
    setBaseTools(cleanTools);
    toast({ title: "Einstellungen gespeichert", variant: "success" });
    router.refresh();
  }

  const memberSinceLabel = useMemo(() => {
    if (!memberSince) return "—";
    return new Intl.DateTimeFormat("de-CH", {
      month: "long",
      year: "numeric",
      timeZone: "UTC",
    }).format(new Date(memberSince));
  }, [memberSince]);

  return (
    <>
      <div className="space-y-4 pb-28">
        {/* Row: Profile + Workspace */}
        <div className="grid gap-4 md:grid-cols-2">
          <SettingsCard
            Icon={User}
            accent="#8B5CF6"
            title="Profil"
            description="Wie du in deinem Workspace erscheinst."
          >
            <div className="space-y-4">
              <Field label="Profilbild">
                <AvatarUpload
                  userId={userId}
                  displayName={displayName}
                  email={email}
                  initialUrl={initialAvatarUrl}
                />
              </Field>

              <Field label="Anzeigename">
                <Input
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                  placeholder="Dein Name"
                  aria-label="Anzeigename"
                  maxLength={60}
                  autoComplete="name"
                  className={cn(
                    nameDirty && !nameValid && "border-red-500/55 focus:border-red-500/70 focus:ring-red-500/20"
                  )}
                />
                {nameDirty && !nameValid && (
                  <p className="text-[12px] text-red-300/90">Der Name darf nicht leer sein.</p>
                )}
              </Field>

              <Field label="Email">
                <div className="flex h-11 items-center rounded-lg border border-white/10 bg-white/[0.015] px-3.5 text-sm text-white/55">
                  {email}
                </div>
                <p className="text-[12px] text-white/40">
                  Mit deinem Login verknüpft — hier nicht änderbar.
                </p>
              </Field>
            </div>
          </SettingsCard>

          <SettingsCard
            Icon={Building2}
            accent="#06B6D4"
            title="Workspace"
            description="Konto- und Plan-Übersicht."
            headerRight={
              <span
                className={cn(
                  "shrink-0 rounded-full border px-2.5 py-1 text-[11px] font-medium capitalize",
                  PLAN_BADGE[plan]
                )}
              >
                {plan}
              </span>
            }
          >
            <div className="divide-y divide-white/[0.06]">
              <InfoRow label="Rolle" value="Eigentümer" />
              <InfoRow label="Mitglied seit" value={memberSinceLabel} />
              <InfoRow label="Account-ID" value={userId.slice(0, 8)} mono />
            </div>
            <Link
              href="/billing"
              className="mt-4 inline-flex items-center gap-1 text-[13px] font-medium text-cyan-300 transition-colors hover:text-cyan-200"
            >
              Plan verwalten
              <ArrowUpRight className="h-3.5 w-3.5" />
            </Link>
          </SettingsCard>
        </div>

        {/* Row: Usage + API providers */}
        <div className="grid gap-4 md:grid-cols-5">
          <SettingsCard
            className="md:col-span-3"
            Icon={Gauge}
            accent="#10B981"
            title="Nutzung"
            description="Dein Verbrauch im aktuellen Abrechnungszeitraum."
          >
            <div className="space-y-5">
              <UsageMeter
                label="Projekte"
                used={usage.projects}
                limit={usage.projectLimit}
              />
              <UsageMeter
                label="Generierungen (Monat)"
                used={usage.generations}
                limit={usage.generationLimit}
              />
            </div>
          </SettingsCard>

          <SettingsCard
            className="md:col-span-2"
            Icon={KeyRound}
            accent="#3B82F6"
            title="API-Provider"
            description="Eigene Keys nutzen (ab Pro)."
            badge="Bald"
          >
            <div className="space-y-2">
              <ProviderRow logo="Claude" name="Anthropic" sub="Claude" />
              <ProviderRow logo="ChatGPT" name="OpenAI" sub="GPT" />
              <ProviderRow logo="Gemini" name="Google" sub="Gemini" />
            </div>
          </SettingsCard>
        </div>

        {/* Default tools — the centerpiece */}
        <SettingsCard
          Icon={Sparkles}
          accent="#A855F7"
          title="Standard-Tools"
          description="Diese Auswahl füllt jedes neue Projekt automatisch vor."
        >
          <div className="grid gap-3 md:grid-cols-2">
            <ToolPickerGroup
              label="KI-Assistent"
              hint="Master-Prompt-Ziel"
              Icon={Sparkles}
              accent="#8B5CF6"
              options={TOOL_OPTIONS.master}
              value={tools.master}
              onChange={(v) => setTools({ ...tools, master: v })}
            />
            <ToolPickerGroup
              label="Frontend-Builder"
              hint="UI-Generierung"
              Icon={LayoutTemplate}
              accent="#3B82F6"
              options={TOOL_OPTIONS.frontend}
              value={tools.frontend}
              onChange={(v) => setTools({ ...tools, frontend: v })}
            />
            <ToolPickerGroup
              label="Backend-Agent"
              hint="Code-Assistent"
              Icon={TerminalSquare}
              accent="#10B981"
              options={TOOL_OPTIONS.backend}
              value={tools.backend}
              onChange={(v) => setTools({ ...tools, backend: v })}
            />
            <ToolPickerGroup
              label="Datenbank"
              hint="Daten-Layer"
              Icon={Database}
              accent="#F59E0B"
              options={TOOL_OPTIONS.database}
              value={tools.database}
              onChange={(v) => setTools({ ...tools, database: v })}
            />
          </div>
        </SettingsCard>

        {/* Security */}
        <SettingsCard
          Icon={Lock}
          accent="#6366F1"
          title="Sicherheit"
          description="Ändere dein Passwort."
        >
          <ChangePassword email={email} />
        </SettingsCard>

        {/* Danger zone */}
        <SettingsCard
          Icon={ShieldAlert}
          accent="#EF4444"
          title="Gefahrenzone"
          description="Unwiderrufliche Aktionen."
        >
          <DeleteAccount email={email} />
        </SettingsCard>
      </div>

      {/* Sticky save bar — Stripe / Linear style */}
      <AnimatePresence>
        {dirty && (
          <motion.div
            initial={{ y: 28, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 28, opacity: 0 }}
            transition={{ type: "spring", stiffness: 380, damping: 30 }}
            className="pointer-events-none fixed inset-x-0 bottom-5 z-50 px-6 md:pl-[280px] md:pr-10"
          >
            <div className="pointer-events-auto flex max-w-[1080px] items-center justify-between gap-4 rounded-2xl border border-white/12 glass-strong px-4 py-3 shadow-[0_24px_70px_-24px_rgba(0,0,0,0.85)]">
              <div className="flex items-center gap-2.5">
                <span className="relative flex h-2 w-2">
                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-amber-400 opacity-70" />
                  <span className="relative inline-flex h-2 w-2 rounded-full bg-amber-400" />
                </span>
                <span className="text-[13.5px] font-medium text-white">
                  Ungespeicherte Änderungen
                </span>
              </div>
              <div className="flex items-center gap-2">
                <Button variant="ghost" size="sm" onClick={cancel} disabled={saving}>
                  Verwerfen
                </Button>
                <Button size="sm" onClick={() => void save()} disabled={!canSave}>
                  {saving ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Speichern…
                    </>
                  ) : (
                    <>
                      <Check className="h-4 w-4" />
                      Speichern
                    </>
                  )}
                </Button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}

/* ─── Presentational pieces ─────────────────────────────────────────────── */

function SettingsCard({
  Icon,
  accent,
  title,
  description,
  badge,
  headerRight,
  className,
  children,
}: {
  Icon: LucideIcon;
  accent: string;
  title: string;
  description: string;
  badge?: string;
  headerRight?: React.ReactNode;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <section
      className={cn(
        "relative overflow-hidden rounded-2xl border border-white/[0.08] bg-gradient-to-b from-white/[0.045] to-white/[0.01] p-6 md:p-7",
        className
      )}
    >
      {/* top hairline highlight */}
      <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-white/20 to-transparent" />
      {/* soft accent glow in the corner */}
      <div
        className="pointer-events-none absolute -right-20 -top-20 h-44 w-44 rounded-full opacity-[0.10] blur-3xl"
        style={{ background: accent }}
      />

      <header className="mb-5 flex items-start gap-3.5">
        <span
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border"
          style={{
            background: `linear-gradient(160deg, ${accent}33, ${accent}0d)`,
            borderColor: `${accent}40`,
          }}
        >
          <Icon className="h-[18px] w-[18px]" style={{ color: accent }} strokeWidth={2} />
        </span>
        <div className="min-w-0 flex-1">
          <h2 className="text-[16px] font-semibold tracking-tight text-white">{title}</h2>
          <p className="mt-0.5 text-[13px] text-white/55">{description}</p>
        </div>
        {badge ? (
          <span className="shrink-0 rounded-full border border-white/[0.10] bg-white/[0.03] px-2 py-0.5 text-[9px] font-mono uppercase tracking-[0.08em] text-white/45">
            {badge}
          </span>
        ) : (
          headerRight
        )}
      </header>

      {children}
    </section>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <span className="block text-[13px] font-medium text-white/70">{label}</span>
      {children}
    </div>
  );
}

function InfoRow({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="flex items-center justify-between py-2.5">
      <span className="text-[13px] text-white/50">{label}</span>
      <span className={cn("text-[13px] text-white/85", mono && "font-mono text-white/70")}>
        {value}
      </span>
    </div>
  );
}

function UsageMeter({ label, used, limit }: { label: string; used: number; limit: number }) {
  const unlimited = !Number.isFinite(limit);
  const pct = unlimited ? 6 : Math.min(100, Math.round((used / Math.max(1, limit)) * 100));
  const tone =
    !unlimited && pct >= 100
      ? "from-red-500 to-red-400"
      : !unlimited && pct >= 80
        ? "from-amber-500 to-amber-400"
        : "from-violet-500 to-violet-400";

  return (
    <div>
      <div className="mb-2 flex items-baseline justify-between">
        <span className="text-[13px] font-medium text-white/80">{label}</span>
        <span className="text-[13px] tabular-nums text-white/55">
          {unlimited ? (
            <>
              {used} <span className="text-white/35">· Unbegrenzt</span>
            </>
          ) : (
            <>
              <span className="text-white/85">{used}</span>
              <span className="text-white/35"> / {limit}</span>
            </>
          )}
        </span>
      </div>
      <div className="h-2 overflow-hidden rounded-full bg-white/[0.06]">
        <motion.div
          initial={{ width: 0 }}
          animate={{ width: `${pct}%` }}
          transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
          className={cn("h-full rounded-full bg-gradient-to-r", tone)}
        />
      </div>
    </div>
  );
}

function ProviderRow({ logo, name, sub }: { logo: string; name: string; sub: string }) {
  return (
    <div className="flex items-center gap-3 rounded-xl border border-white/[0.07] bg-white/[0.015] px-3 py-2.5">
      <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-white/10 bg-white/[0.03]">
        <ToolLogo name={logo} size={16} />
      </span>
      <div className="min-w-0 flex-1 leading-tight">
        <div className="truncate text-[13px] font-medium text-white">{name}</div>
        <div className="truncate text-[11px] text-white/40">{sub}</div>
      </div>
      <span className="shrink-0 rounded-full border border-white/[0.10] bg-white/[0.03] px-2 py-0.5 text-[9px] font-mono uppercase tracking-[0.08em] text-white/45">
        Bald
      </span>
    </div>
  );
}
