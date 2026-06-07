# PromptPrinter — Design System

> **Richtung:** Refined Dev-Brand (Linear / Vercel / Raycast). Monochrome Chrome
> + **ein** Akzent (Babyblau). Light **und** Dark mit Toggle. Weg von
> Glassmorphism-Glow / Purple-Gradients / Shimmer-Deko.

## Themes

Light + Dark über `next-themes` (`attribute="class"`, `defaultTheme="dark"`,
`enableSystem`). Der Umschalter ist `ThemeToggle` (`src/components/ui/theme-toggle.tsx`),
sitzt in der Topbar. Tokens flippen über `.dark` auf `<html>`.

## Farb-Tokens

Alle Farben sind semantische CSS-Variablen in `src/app/globals.css`
(`:root` = light, `.dark` = dark), als HSL-Channels gespeichert, damit
Tailwind-Opacity (`bg-accent/10`, `ring-ring/40`) funktioniert. **Nie rohe
Hex-Werte in Komponenten** — immer Token-Utilities nutzen.

| Token (Tailwind) | Rolle | Light | Dark |
|---|---|---|---|
| `bg-background` / `text-foreground` | Seite | `#FFFFFF` / `#0B0D10` | `#0C0E12` / `#E8EBEF` |
| `bg-surface` | Panel / Input-BG | `#F6F8FA` | `#14171C` |
| `bg-surface-raised` | Card / Dropdown | `#FFFFFF` | `#1A1E24` |
| `bg-surface-hover` | Hover-Fläche | `#EEF1F4` | `#1F242B` |
| `border-border` / `border-border-strong` | Hairlines | `#E3E8EE` / `#CDD5DF` | `#24292F` / `#323841` |
| `text-muted-foreground` | Sekundärtext | `#5B6573` | `#9AA4B2` |
| `bg-primary` / `text-primary-foreground` | **Primär-CTA (monochrom)** | `#0B0D10` / weiss | `#F2F4F7` / `#0B0D10` |
| `bg-accent` / `text-accent-foreground` | **Babyblau-Fill** | `#7FC4F0` / near-black | `#8FCDF2` / near-black |
| `text-accent-text` | **Links / Akzent-Text** (kontrast-sicher) | `#15679E` | `#8FCDF2` |
| `bg-accent-subtle` | Akzent-Tint-Fläche | hell-babyblau | dunkel-babyblau |
| `ring-ring` | Focus-Ring | babyblau | babyblau |
| `bg-destructive` / `success` / `warning` | Status | — | — |

### Akzent-Regeln (wichtig)

- **Primär-Aktionen sind monochrom** (`variant="primary"` = schwarz/weiss).
- **Babyblau ist Akzent**, nicht Default-CTA: Links, aktive Nav, Focus-Ring,
  Selection, Charts, Brand-Momente. Babyblau-Fill nur via `variant="accent"`
  (trägt dunklen Text, nie weissen — sonst Kontrast < 4.5:1).
- Farbiger Akzent-**Text** immer `text-accent-text` (pro Theme kalibriert),
  nie `text-accent` (das ist der helle Fill-Ton, auf Weiss unlesbar).

## Typografie

- **Geist Sans** (`font-sans`) — UI & Fliesstext.
- **Geist Mono** (`font-mono`) — Labels, Caps, tabellarische Zahlen, Code,
  Chips, Tastatur-Shortcuts.
- Type-Scale: `display-*`, `headline-*`, `body-*`, `label`, `label-caps`, `code`
  (siehe `tailwind.config.ts`).

## Form & Motion

- Radius eng: `sm 6 / md 8 / lg 10 / xl 12 / 2xl 16`.
- Flache Flächen + 1px-Hairline-Border statt Glassmorphism. Shadows dezent
  (`shadow-card`, `shadow-elevated`).
- Micro-Interaktionen 150–300 ms, `prefers-reduced-motion` respektieren.

## Regeln (aus ui-ux-pro-max)

- Kontrast ≥ 4.5:1 (Text), ≥ 3:1 (grosse Glyphen/UI).
- Sichtbare Focus-Rings (`focus-visible:ring-2 ring-ring/50`), nie entfernen.
- Tap-Targets ≥ 44px, Icon-only-Buttons brauchen `aria-label`.
- SVG-Icons (Lucide), keine Emoji als Icons; konsistente Stroke-Width (~1.8).
- Beide Themes vor Auslieferung testen — nicht aus einem ableiten.

## Komponenten-Migration (Status)

- **Phase A — Fundament:** Tokens, `globals.css`, Root-Layout + Geist +
  ThemeProvider, ThemeToggle, UI-Primitives (button/card/input/label/toast/
  skeleton/password-input), Topbar. ✅
- **Phase B — App-Shell:** sidebar, mobile-nav, command-palette, dashboard,
  chat, projects, generations, library, settings, billing.
- **Phase C — Marketing + Auth + Legal.**

> Alte Deko-Klassen (`.glass`, `.gradient-text`, …) sind in `globals.css` als
> token-basierte Shims erhalten, damit noch nicht migrierte Komponenten in
> beiden Themes nicht zerbrechen. Beim Migrieren durch echte Token-Utilities
> ersetzen.
