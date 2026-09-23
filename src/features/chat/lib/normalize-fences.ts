// Repariert einen Codeblock, den das Modell auf derselben Zeile schliesst.
//
// Audit 23.09.2026, F-3: glm-4.5-air beendet den Prompt-Block regelmaessig so:
//
//   ```text
//   …fuer Buchungsanfragen.```
//
// CommonMark erkennt eine schliessende Fence nur auf einer eigenen Zeile. Der
// Block bleibt dann offen bis zum Ende der Antwort, die drei Backticks stehen
// sichtbar im Prompt, und "Prompt kopieren" kopiert sie mit ins Bau-Tool.
// "Speichern" war davon nie betroffen, extractPrompt (saved-prompts.ts) sucht
// mit einer Regex, die das Ende auch mitten in der Zeile findet — Kopieren und
// Speichern lieferten also verschiedene Texte.
//
// Die Reparatur: innerhalb eines offenen Blocks eine Zeile, die auf
// mindestens so viele Backticks endet, wie der Block geoeffnet hat, in Inhalt
// und eigene Schlusszeile aufteilen. Nur innerhalb eines offenen Blocks, damit
// normaler Fliesstext mit Backticks unangetastet bleibt.

const OPENING_FENCE = /^ {0,3}(`{3,}|~{3,})/;

export function normalizeFences(markdown: string): string {
  const lines = markdown.split("\n");
  const out: string[] = [];
  // Das oeffnende Fence-Zeichen samt Laenge, solange ein Block offen ist.
  let open: { char: string; length: number } | null = null;

  for (const line of lines) {
    if (!open) {
      const match = line.match(OPENING_FENCE);
      if (match) open = { char: match[1][0], length: match[1].length };
      out.push(line);
      continue;
    }

    const trimmed = line.trim();
    const run = fenceRun(trimmed, open.char);

    if (run >= open.length && run === trimmed.length) {
      // Eine regulaere Schlusszeile.
      open = null;
      out.push(line);
    } else if (run >= open.length && open.char === "`") {
      // Inhalt plus Fence auf derselben Zeile: in zwei Zeilen aufteilen.
      out.push(line.replace(/\s*`+\s*$/, ""));
      out.push("`".repeat(open.length));
      open = null;
    } else {
      out.push(line);
    }
  }

  return out.join("\n");
}

/** Wie viele `char` am Ende von `text` stehen. */
function fenceRun(text: string, char: string): number {
  let count = 0;
  for (let i = text.length - 1; i >= 0 && text[i] === char; i--) count++;
  return count;
}
