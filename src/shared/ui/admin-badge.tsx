// Die Pille "Admin" für Konten mit `profiles.is_admin`, überall dieselbe (Kontomenü, Einstellungen, Nutzung).
// Ein anderes Abzeichen gibt es nicht: jedes andere Konto hat denselben Umfang, da gibt es nichts anzuzeigen.
// "Admin" bleibt in jeder Sprache unübersetzt, wie im Wörterbuch (shared/i18n/messages/de.ts).
export function AdminBadge() {
  return (
    <span className="shrink-0 rounded-full border border-warning/40 bg-warning/15 px-2.5 py-1 text-[12px] font-medium text-warning">
      Admin
    </span>
  );
}
