/** Der Fehlerkasten eines Formulars. Ohne Text steht nichts da. */
export function FormError({ children }: { children: React.ReactNode }) {
  if (!children) return null;
  return (
    <div
      role="alert"
      className="rounded-xl border border-destructive/30 bg-destructive/10 px-4 py-2.5 text-[13px] text-destructive"
    >
      {children}
    </div>
  );
}
