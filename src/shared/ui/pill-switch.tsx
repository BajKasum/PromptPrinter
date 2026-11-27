import Link from "next/link";
import type { LucideIcon } from "lucide-react";
import { cn } from "@/shared/lib/utils";

// Der Pillen-Umschalter zwischen zwei Ansichten: in der App als Links (shell/components/tab-switcher.tsx), in der
// Vorschau der Landing als Knöpfe (product-showcase.tsx). Aussehen und Zustand für Hilfstechnik stehen hier.

type PillProps = { active: boolean; Icon: LucideIcon; label: string };

/** Die Leiste um die Pillen. `className` setzt nur den Abstand nach aussen. */
export function PillSwitch({ className, children }: { className?: string; children: React.ReactNode }) {
  return (
    <div className={cn(className, "flex items-center gap-1 rounded-lg border border-border bg-surface p-1")}>
      {children}
    </div>
  );
}

/** Eine Pille, die zu einer Seite führt; die aktive trägt `aria-current`. */
export function PillLink({ href, active, Icon, label }: PillProps & { href: string }) {
  return (
    <Link href={href} aria-current={active ? "page" : undefined} className={pillClass(active)}>
      <Icon className="h-3.5 w-3.5" strokeWidth={2} />
      {label}
    </Link>
  );
}

/** Eine Pille, die nur die Ansicht umschaltet; sie sagt mit `aria-pressed`, ob sie gewählt ist. */
export function PillButton({ onClick, active, Icon, label }: PillProps & { onClick: () => void }) {
  return (
    <button type="button" aria-pressed={active} onClick={onClick} className={pillClass(active)}>
      <Icon className="h-3.5 w-3.5" strokeWidth={2} />
      {label}
    </button>
  );
}

// Der inaktive Zustand nutzt `text-secondary`, die dafür kalibrierte Stufe: eine Alpha-Stufe auf
// muted-foreground liegt unter der AA-Schwelle.
function pillClass(active: boolean) {
  return cn(
    "flex flex-1 items-center justify-center gap-1.5 rounded-md py-1.5 text-[12.5px] font-medium transition-colors",
    active ? "bg-surface-raised text-foreground shadow-xs" : "text-secondary hover:text-foreground"
  );
}
