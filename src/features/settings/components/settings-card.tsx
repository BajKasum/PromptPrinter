import { cn, hslVar } from "@/shared/lib/utils";
import type { LucideIcon } from "lucide-react";

// Die Bausteine der Einstellungsseite, ausgelagert aus settings-workspace.tsx (Betriebs-Audit, Folgesitzung
// 2026-10-07, Dateigroesse): die Karte mit Kopf und Akzent, ein beschriftetes Feld, eine Info-Zeile.

/* ─── Presentational pieces ─────────────────────────────────────────────── */

export function SettingsCard({
  id,
  Icon,
  accent,
  title,
  description,
  badge,
  headerRight,
  className,
  children,
}: {
  /** Sprunganker, z. B. fuer den Key-Hinweis im Chat (/settings#api-keys). */
  id?: string;
  Icon: LucideIcon;
  /** A design-token CSS variable name (e.g. "--accent"), not a literal color — see hslVar. */
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
      id={id}
      className={cn(
        "relative scroll-mt-24 overflow-hidden rounded-2xl border border-border bg-surface-raised p-6 md:p-7",
        className
      )}
    >
      {/* top hairline highlight */}
      <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-border-strong to-transparent" />
      {/* soft accent glow in the corner */}
      <div
        className="pointer-events-none absolute -right-20 -top-20 h-44 w-44 rounded-full opacity-[0.10] blur-3xl"
        style={{ background: hslVar(accent) }}
      />

      <header className="mb-5 flex items-start gap-2.5">
        <Icon
          className="mt-0.5 h-[18px] w-[18px] shrink-0"
          style={{ color: hslVar(accent) }}
          strokeWidth={1.8}
        />
        <div className="min-w-0 flex-1">
          <h2 className="text-[16px] font-semibold tracking-tight text-foreground">{title}</h2>
          <p className="mt-0.5 text-[13px] text-secondary">{description}</p>
        </div>
        {badge ? (
          <span className="shrink-0 rounded-full border border-border bg-surface px-2 py-0.5 text-[9px] font-mono uppercase tracking-[0.08em] text-tertiary">
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

export function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <span className="block text-[13px] font-medium text-foreground/70">{label}</span>
      {children}
    </div>
  );
}

export function InfoRow({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="flex items-center justify-between py-2.5">
      <span className="text-[13px] text-tertiary">{label}</span>
      <span className={cn("text-[13px] text-foreground/85", mono && "font-mono text-foreground/70")}>
        {value}
      </span>
    </div>
  );
}
