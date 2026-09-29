// Tastenkürzel für die Ziele im Kontomenü (Wunsch 29.09.2026: "wie Strg+Komma
// bei Claude Code"). Eine Stelle definiert sie, drei lesen sie: der globale
// Listener (use-nav-shortcuts.ts), die Hinweise im Kontomenü und die
// Befehlspalette. So kann ein Hinweis nie ein Kürzel versprechen, das niemand
// abfängt, und umgekehrt.
//
// Die Wahl der Tasten:
// - Einstellungen auf Strg/⌘ + Komma, die verbreitete Konvention (Claude,
//   VS Code, Slack, macOS-Apps). Im Browser ist sie frei, Chrome gibt der
//   Seite den Vortritt.
// - Die anderen drei auf Strg/⌘ + Shift + Buchstabe. Nur mit Shift, weil
//   Strg + Buchstabe fast vollständig vom Browser belegt ist und einige davon
//   (Strg+N, Strg+T, Strg+W) eine Seite gar nicht abfangen darf.
//   U = Usage/Nutzung, S = Saved/gespeichert, B = Billing. Strg+Shift+B
//   blendet in Chrome sonst die Lesezeichenleiste ein; das bleibt ausserhalb
//   der App unberührt und ist der seltenste der möglichen Konflikte.
// - Alt ist ausgeschlossen: Strg+Alt ist unter Windows AltGr, auf einer
//   Schweizer oder deutschen Tastatur also "@", "€" oder "#". Ein Kürzel
//   darauf würde Tippen verhindern.

export type Shortcut = {
  /** `KeyboardEvent.key` in Kleinbuchstaben. */
  key: string;
  shift: boolean;
};

type KeyLike = Pick<KeyboardEvent, "key" | "ctrlKey" | "metaKey" | "shiftKey" | "altKey">;

/**
 * Trifft das Ereignis genau dieses Kürzel? Shift muss exakt stimmen, sonst
 * löst Strg+Shift+B auch das Strg+B der Seitenleiste aus (und umgekehrt).
 */
export function matchesShortcut(e: KeyLike, s: Shortcut): boolean {
  if (!(e.ctrlKey || e.metaKey) || e.altKey) return false;
  if (e.shiftKey !== s.shift) return false;
  return e.key.toLowerCase() === s.key;
}

/** macOS zeigt Symbole (⇧⌘U), alle anderen die ausgeschriebene Taste. */
export function isMacPlatform(): boolean {
  if (typeof navigator === "undefined") return false;
  return /Mac|iPhone|iPad|iPod/.test(navigator.platform || navigator.userAgent);
}

export function formatShortcut(s: Shortcut, mac: boolean, ctrlLabel = "Strg"): string {
  const key = s.key === "," ? "," : s.key.toUpperCase();
  if (mac) return `${s.shift ? "⇧" : ""}⌘${key}`;
  return [ctrlLabel, s.shift ? "Shift" : null, key].filter(Boolean).join("+");
}

/** Für `aria-keyshortcuts`: beide Modifier, weil beide funktionieren. */
export function ariaShortcut(s: Shortcut): string {
  const key = s.key === "," ? "," : s.key.toUpperCase();
  const shift = s.shift ? "Shift+" : "";
  return `Control+${shift}${key} Meta+${shift}${key}`;
}
