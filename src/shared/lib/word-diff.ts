/**
 * Wort-Diff zweier Fassungen eines Prompts, für den Verlauf gespeicherter Prompts. Ohne Paket: jede Abhängigkeit geht
 * durch `audit:gate`, und der Algorithmus ist kurz.
 *
 * Myers-Diff (O((N+M)·D)) über Wörter und Leerraum, sodass beide Fassungen aus den Teilen wieder entstehen:
 * `same` + `removed` ergibt den alten Text, `same` + `added` den neuen. Gemeinsamer Anfang und gemeinsames Ende
 * zählen nicht mit. Gespeichert werden nur die Zeilen der Schritte, die es braucht (D² Zahlen). Sind es mehr als
 * `maxEdits` Schritte, vergleicht er Zeilen statt Wörter, und reicht auch das nicht, steht die alte Fassung ganz als
 * entfernt und die neue ganz als eingefügt da. So bleibt der Vergleich auch bei 40 000 Zeichen im Browser schnell.
 */

export type DiffKind = "same" | "added" | "removed";
export type DiffPart = { kind: DiffKind; text: string };

/** Höchstzahl der Änderungsschritte, bevor auf Zeilen und danach auf "alles neu" gewechselt wird. */
export const MAX_DIFF_EDITS = 2000;

const WORDS = /\s+|[^\s]+/g;
const LINES = /[^\n]*\n|[^\n]+/g;

export function diffWords(before: string, after: string, maxEdits = MAX_DIFF_EDITS): DiffPart[] {
  if (before === after) return before ? [{ kind: "same", text: before }] : [];
  return (
    diffTokens(before.match(WORDS) ?? [], after.match(WORDS) ?? [], maxEdits) ??
    diffTokens(before.match(LINES) ?? [], after.match(LINES) ?? [], maxEdits) ??
    wholesale(before, after)
  );
}

/** Ändert sich mindestens ein Zeichen? Für "keine Änderung" im Vergleich. */
export function hasChanges(parts: readonly DiffPart[]): boolean {
  return parts.some((p) => p.kind !== "same");
}

function wholesale(before: string, after: string): DiffPart[] {
  let start = 0;
  while (start < before.length && start < after.length && before[start] === after[start]) start += 1;
  let end = 0;
  while (
    end < before.length - start &&
    end < after.length - start &&
    before[before.length - 1 - end] === after[after.length - 1 - end]
  ) {
    end += 1;
  }
  return merge([
    { kind: "same", text: before.slice(0, start) },
    { kind: "removed", text: before.slice(start, before.length - end) },
    { kind: "added", text: after.slice(start, after.length - end) },
    { kind: "same", text: before.slice(before.length - end) },
  ]);
}

/** Diff zweier Folgen; null, wenn er mehr als `maxEdits` Schritte bräuchte. */
function diffTokens(a: string[], b: string[], maxEdits: number): DiffPart[] | null {
  let head = 0;
  while (head < a.length && head < b.length && a[head] === b[head]) head += 1;
  let tail = 0;
  while (tail < a.length - head && tail < b.length - head && a[a.length - 1 - tail] === b[b.length - 1 - tail]) {
    tail += 1;
  }
  const middle = myers(a.slice(head, a.length - tail), b.slice(head, b.length - tail), maxEdits);
  if (!middle) return null;
  return merge([
    { kind: "same", text: a.slice(0, head).join("") },
    ...middle,
    { kind: "same", text: a.slice(a.length - tail).join("") },
  ]);
}

function myers(a: string[], b: string[], maxEdits: number): DiffPart[] | null {
  const n = a.length;
  const m = b.length;
  // trace[d][k + d] = das weiteste x auf Diagonale k nach d Schritten.
  const trace: Int32Array[] = [];
  const reach = (d: number, k: number) => trace[d][k + d];

  for (let d = 0; d <= Math.min(n + m, maxEdits); d += 1) {
    const v = new Int32Array(2 * d + 1);
    for (let k = -d; k <= d; k += 2) {
      let x: number;
      if (d === 0) x = 0;
      else if (k === -d || (k !== d && reach(d - 1, k - 1) < reach(d - 1, k + 1))) x = reach(d - 1, k + 1);
      else x = reach(d - 1, k - 1) + 1;
      let y = x - k;
      while (x < n && y < m && a[x] === b[y]) {
        x += 1;
        y += 1;
      }
      v[k + d] = x;
      if (x >= n && y >= m) {
        trace.push(v);
        return backtrack(trace, a, b);
      }
    }
    trace.push(v);
  }
  return null;
}

function backtrack(trace: Int32Array[], a: string[], b: string[]): DiffPart[] {
  const reach = (d: number, k: number) => trace[d][k + d];
  const out: DiffPart[] = [];
  let x = a.length;
  let y = b.length;

  for (let d = trace.length - 1; d > 0; d -= 1) {
    const k = x - y;
    const down = k === -d || (k !== d && reach(d - 1, k - 1) < reach(d - 1, k + 1));
    const prevK = down ? k + 1 : k - 1;
    const prevX = reach(d - 1, prevK);
    const prevY = prevX - prevK;
    while (x > prevX && y > prevY) {
      out.push({ kind: "same", text: a[x - 1] });
      x -= 1;
      y -= 1;
    }
    if (down) {
      out.push({ kind: "added", text: b[y - 1] });
      y -= 1;
    } else {
      out.push({ kind: "removed", text: a[x - 1] });
      x -= 1;
    }
  }
  while (x > 0 && y > 0) {
    out.push({ kind: "same", text: a[x - 1] });
    x -= 1;
    y -= 1;
  }
  return out.reverse();
}

/**
 * Fasst zusammen: gleiche Stellen am Stück, und jeder Block zwischen zwei gleichen Stellen als ein entfernter und ein
 * eingefügter Teil, in dieser Reihenfolge. Leere Teile fallen weg.
 */
function merge(parts: DiffPart[]): DiffPart[] {
  const out: DiffPart[] = [];
  let removed = "";
  let added = "";
  const flush = () => {
    if (removed) out.push({ kind: "removed", text: removed });
    if (added) out.push({ kind: "added", text: added });
    removed = "";
    added = "";
  };
  for (const part of parts) {
    if (!part.text) continue;
    if (part.kind === "removed") removed += part.text;
    else if (part.kind === "added") added += part.text;
    else {
      flush();
      const last = out[out.length - 1];
      if (last?.kind === "same") last.text += part.text;
      else out.push({ kind: "same", text: part.text });
    }
  }
  flush();
  return out;
}
