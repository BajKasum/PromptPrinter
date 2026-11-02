"use client";

// Die Tippfläche für das Verfeinern (#245): eine runde Fläche von mindestens 44 px Höhe, per Tastatur
// erreichbar, mit sichtbarem Fokus.
export function TapChip({ children, onClick }: { children: string; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="inline-flex min-h-11 items-center rounded-full border border-border bg-surface px-4 text-[13px] text-foreground/90 transition-colors hover:border-border-strong hover:bg-surface-hover focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-ring/50"
    >
      {children}
    </button>
  );
}
