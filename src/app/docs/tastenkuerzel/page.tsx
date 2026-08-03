import type { Metadata } from "next";
import { DocsShell } from "@/components/marketing/docs-shell";
import { docBySlug } from "@/shared/lib/docs-nav";

const doc = docBySlug("tastenkuerzel")!;

export const metadata: Metadata = {
  title: doc.title,
  description: doc.summary,
};

const SHORTCUTS = [
  {
    keys: "⌘ K / Strg + K",
    what: "Befehlspalette öffnen",
    detail: "Durchsucht deine Chats, Projekte und Seiten und springt direkt hin.",
  },
  {
    keys: "⌘ B / Strg + B",
    what: "Seitenleiste ein- und ausklappen",
    detail: "Der Zustand bleibt erhalten, auch beim nächsten Besuch.",
  },
  {
    keys: "Enter",
    what: "Nachricht senden",
    detail: "Im Eingabefeld des Chats.",
  },
  {
    keys: "Shift + Enter",
    what: "Zeilenumbruch",
    detail: "Für längere Beschreibungen, ohne dass die Nachricht rausgeht.",
  },
  {
    keys: "Esc",
    what: "Schliessen",
    detail: "Beendet die Befehlspalette, Menüs und das mobile Menü.",
  },
];

export default function Page() {
  return (
    <DocsShell
      slug={doc.slug}
      title="Tastenkürzel"
      intro="Eine kurze Liste, absichtlich. Fünf Kürzel reichen, um ohne Maus durchzukommen."
    >
      <div className="overflow-hidden rounded-xl border border-border">
        <table className="w-full text-left">
          <thead>
            <tr className="border-b border-border bg-surface">
              <th className="px-4 py-2.5 text-[12px] font-mono uppercase tracking-[0.08em] text-tertiary">
                Kürzel
              </th>
              <th className="px-4 py-2.5 text-[12px] font-mono uppercase tracking-[0.08em] text-tertiary">
                Funktion
              </th>
            </tr>
          </thead>
          <tbody>
            {SHORTCUTS.map((s) => (
              <tr key={s.keys} className="border-b border-border last:border-0">
                <td className="whitespace-nowrap px-4 py-3.5 align-top">
                  <span className="rounded-md border border-border bg-surface px-2 py-1 text-[12.5px] font-mono text-foreground/80">
                    {s.keys}
                  </span>
                </td>
                <td className="px-4 py-3.5">
                  <span className="block text-[14px] font-medium text-foreground">
                    {s.what}
                  </span>
                  <span className="mt-0.5 block text-[13px] leading-[1.55] text-secondary">
                    {s.detail}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <h2>Die Befehlspalette</h2>
      <p>
        Das ist das einzige Kürzel, das du dir wirklich merken solltest. Es gibt
        bewusst kein Suchfeld in der Oberfläche, das dauerhaft Platz wegnimmt,
        stattdessen holst du die Suche mit einem Griff hervor, tippst ein paar
        Buchstaben und bist dort, wo du hinwolltest.
      </p>

      <h2>Auf dem Handy</h2>
      <p>
        Dort gibt es keine Tastenkürzel. Die Navigation läuft über das
        Menüsymbol oben links, das dieselbe Chat- und Projektliste öffnet wie die
        Seitenleiste am Rechner.
      </p>
    </DocsShell>
  );
}
