"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";
import {
  User,
  Languages,
  Building2,
  KeyRound,
  Lock,
  Database,
  ShieldAlert,
  ArrowUpRight,
  Loader2,
  Check,
  SunMoon,
} from "lucide-react";
import { Input } from "@/shared/ui/input";
import { Button } from "@/shared/ui/button";
import { useToast } from "@/shared/ui/toast";
import { DeleteAccount } from "@/features/settings/components/delete-account";
import { ChangePassword } from "@/features/settings/components/change-password";
import { DataExport } from "@/features/settings/components/data-export";
import { ThemePreference } from "@/features/settings/components/theme-preference";
import { ApiKeys } from "@/features/settings/components/api-keys";
import { PlanBadge } from "@/shared/ui/plan-badge";
import type { CustomProviderMeta } from "@/shared/lib/byok-types";
import type { PlanKey } from "@/shared/lib/plans";
import { createClient } from "@/shared/supabase/client";
import { cn } from "@/shared/lib/utils";
import { useLocale, useT } from "@/shared/i18n/provider";
import { LOCALE_TAGS } from "@/shared/i18n/locales";
import { LanguagePreference } from "@/features/settings/components/language-preference";
import { Field, InfoRow, SettingsCard } from "@/features/settings/components/settings-card";
type ByokProvider = "anthropic" | "openai" | "gemini" | "custom";

export function SettingsWorkspace({
  userId,
  email,
  initialDisplayName,
  plan,
  isAdmin = false,
  memberSince,
  configuredProviders,
  activeProvider,
  customProvider,
}: {
  userId: string;
  email: string;
  initialDisplayName: string;
  plan: PlanKey;
  /** A role (profiles.is_admin), not a plan, shows "Admin" instead of the
   * tier badge. */
  isAdmin?: boolean;
  memberSince: string | null;
  /** Which BYOK providers this user already has a key stored for. */
  configuredProviders: ByokProvider[];
  /** Which stored key actually runs this user's chats (Security-Audit M-6). */
  activeProvider: ByokProvider | null;
  /** The user's custom-endpoint BYOK config (no key), if any. */
  customProvider: CustomProviderMeta | null;
}) {
  const t = useT();
  const locale = useLocale();
  const router = useRouter();
  const { toast } = useToast();

  // Der Key-Hinweis im Chat verlinkt /settings#api-keys (Audit 23.09.2026,
  // F-1). Next scrollt bei einer Client-Navigation nur dann zum Anker, wenn
  // das Ziel schon steht, wenn die Route wechselt; diese Seite blendet aber
  // erst ein. Deshalb hier einmal nach dem Mount selbst hinscrollen.
  useEffect(() => {
    const id = window.location.hash.slice(1);
    if (!id) return;
    const frame = requestAnimationFrame(() => {
      document.getElementById(id)?.scrollIntoView({ block: "start" });
    });
    return () => cancelAnimationFrame(frame);
  }, []);

  // Current edits vs. the saved baseline. The baseline advances on a successful
  // save so the dirty state (and the save bar) reset without a full reload.
  const [displayName, setDisplayName] = useState(initialDisplayName);
  const [baseName, setBaseName] = useState(initialDisplayName);
  const [saving, setSaving] = useState(false);

  const nameTrimmed = displayName.trim();
  const nameDirty = nameTrimmed !== baseName.trim();
  const nameValid = nameTrimmed.length > 0;
  const dirty = nameDirty;
  const canSave = dirty && !saving && !(nameDirty && !nameValid);

  function cancel() {
    setDisplayName(baseName);
  }

  async function save() {
    if (!canSave) return;
    setSaving(true);

    const patch: Record<string, unknown> = {};
    if (nameDirty && nameValid) patch.display_name = nameTrimmed;

    const supabase = createClient();
    const { error } = await supabase.from("profiles").update(patch).eq("id", userId);
    setSaving(false);

    if (error) {
      toast({
        title: t.settings.saveFailed,
        description: t.settings.tryAgain,
        variant: "error",
      });
      return;
    }

    // Advance the baseline to the just-saved (trimmed) values so the bar slides
    // away and the visible fields reflect exactly what was stored.
    setDisplayName(nameTrimmed);
    setBaseName(nameTrimmed);
    toast({ title: t.settings.saved, variant: "success" });
    router.refresh();
  }

  const memberSinceLabel = useMemo(() => {
    if (!memberSince) return "-";
    return new Intl.DateTimeFormat(LOCALE_TAGS[locale].intl, {
      month: "long",
      year: "numeric",
      timeZone: "UTC",
    }).format(new Date(memberSince));
  }, [memberSince, locale]);

  return (
    <>
      <div className="space-y-4 pb-28">
        {/* Row: Profile + Workspace */}
        <div className="grid gap-4 md:grid-cols-2">
          <SettingsCard
            Icon={User}
            accent="--accent"
            title={t.settings.profile}
            description={t.settings.profileHint}
          >
            <div className="space-y-4">
              <Field label={t.settings.displayName}>
                <Input
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                  placeholder={t.settings.displayNamePlaceholder}
                  aria-label={t.settings.displayName}
                  maxLength={60}
                  autoComplete="name"
                  className={cn(
                    nameDirty && !nameValid && "border-destructive/55 focus:border-destructive/70 focus:ring-destructive/20"
                  )}
                />
                {nameDirty && !nameValid && (
                  <p className="text-[12px] text-destructive/90">{t.settings.nameEmpty}</p>
                )}
              </Field>

              <Field label={t.settings.email}>
                <div className="flex h-11 items-center rounded-lg border border-border bg-surface px-3.5 text-sm text-secondary">
                  {email}
                </div>
                <p className="text-[12px] text-tertiary">{t.settings.emailHint}</p>
              </Field>
            </div>
          </SettingsCard>

          <SettingsCard
            Icon={Building2}
            accent="--accent"
            title={t.settings.workspace}
            description={t.settings.workspaceHint}
            headerRight={<PlanBadge plan={plan} isAdmin={isAdmin} />}
          >
            <div className="divide-y divide-border">
              <InfoRow label={t.settings.role} value={t.settings.owner} />
              <InfoRow label={t.settings.memberSince} value={memberSinceLabel} />
            </div>
            <Link
              href="/billing"
              className="mt-4 inline-flex items-center gap-1 text-[13px] font-medium text-accent-text transition-colors hover:text-accent-text/80"
            >
              {t.settings.managePlan}
              <ArrowUpRight className="h-3.5 w-3.5" />
            </Link>
          </SettingsCard>
        </div>

        {/* Appearance, a deliberate workspace preference, not a header toggle. */}
        <SettingsCard
          Icon={SunMoon}
          accent="--accent"
          title={t.settings.appearance}
          description={t.settings.appearanceHint}
        >
          <ThemePreference />
        </SettingsCard>

        {/* Sprache (29.09.2026): dieselbe Wahl wie im Kontomenü, hier für
            alle, die sie in den Einstellungen suchen. */}
        <SettingsCard
          id="language"
          Icon={Languages}
          accent="--accent"
          title={t.settings.language}
          description={t.settings.languageHint}
        >
          <LanguagePreference />
        </SettingsCard>

        <SettingsCard
          id="api-keys"
          Icon={KeyRound}
          accent="--accent"
          title={t.settings.apiKeys}
          description={t.settings.apiKeysHint}
        >
          <ApiKeys
            configured={configuredProviders}
            active={activeProvider}
            customProvider={customProvider}
          />
          <p className="mt-3 text-[12px] text-tertiary">{t.settings.apiKeysNote}</p>
        </SettingsCard>

        {/* M-18 (Audit 06.09.2026): die "Standard-Tools"-Karte sass hier
            zwischen API-Keys und Sicherheit — 4 Werte, die einzig in dieses
            Formular hinein- und wieder herausgelesen wurden, ohne dass ein
            anderer Codepfad sie je nutzte. Ein Überbleibsel der am
            17.07.2026 gelöschten Chat→Ergebnis-Pipeline, die pro Generierung
            genau diese vier Dimensionen (Master-KI/Frontend/Backend/DB)
            abfragte. Komplett entfernt statt an eine neue
            Wirkung angeschlossen (features/settings/lib/tools.ts, der
            tool-picker.tsx und die dafuer nicht mehr gebrauchten
            ToolLogo-Faelle gingen mit). */}

        {/* Security */}
        <SettingsCard
          Icon={Lock}
          accent="--accent"
          title={t.settings.security}
          description={t.settings.securityHint}
        >
          <ChangePassword />
        </SettingsCard>

        {/* Your data: self-service export (Betriebs-Audit 04.10.2026) */}
        <SettingsCard
          Icon={Database}
          accent="--accent"
          title={t.settings.dataExport.title}
          description={t.settings.dataExport.hint}
        >
          <DataExport />
        </SettingsCard>

        {/* Danger zone */}
        <SettingsCard
          Icon={ShieldAlert}
          accent="--destructive"
          title={t.settings.danger}
          description={t.settings.dangerHint}
        >
          <DeleteAccount email={email} />
        </SettingsCard>
      </div>

      {/* Sticky save bar, Stripe / Linear style. M-19 (Audit 06.09.2026):
          used to hardcode md:pl-[280px] — didn't match the sidebar's actual
          default (264px), let alone its resizable (220-380px) or collapsed
          (68px) states. --sidebar-w is kept live by sidebar.tsx; the
          fallback only ever applies for the one frame before that effect
          runs, and this bar never renders that early (it needs `dirty`
          first, well after mount). */}
      <AnimatePresence>
        {dirty && (
          <motion.div
            initial={{ y: 28, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 28, opacity: 0 }}
            transition={{ type: "spring", stiffness: 380, damping: 30 }}
            className="pointer-events-none fixed inset-x-0 bottom-5 z-50 px-6 md:pl-[var(--sidebar-w,264px)] md:pr-10"
          >
            <div className="pointer-events-auto flex max-w-[1080px] items-center justify-between gap-4 rounded-2xl border border-border glass-strong px-4 py-3 shadow-[0_24px_70px_-24px_rgba(0,0,0,0.85)]">
              <div className="flex items-center gap-2.5">
                <span className="relative flex h-2 w-2">
                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-warning opacity-70" />
                  <span className="relative inline-flex h-2 w-2 rounded-full bg-warning" />
                </span>
                <span className="text-[13.5px] font-medium text-foreground">
                  {t.settings.unsaved}
                </span>
              </div>
              <div className="flex items-center gap-2">
                <Button variant="ghost" size="sm" onClick={cancel} disabled={saving}>
                  {t.settings.discard}
                </Button>
                <Button size="sm" onClick={() => void save()} disabled={!canSave}>
                  {saving ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      {t.settings.savingEllipsis}
                    </>
                  ) : (
                    <>
                      <Check className="h-4 w-4" />
                      {t.common.save}
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
