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

> **Hinweis (Finn's World, Phase 1):** Die dunklen Neutrals oben wurden auf einen
> einheitlichen ozeanischen Hue (`208`) rekalibriert (Hue-only, S/L unverändert).
> Aktuelle Ist-Werte + die noch **geplante** Light-Kalibrierung stehen unten im
> Abschnitt **Finn's World**.

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
  chat, projects, generations, library, settings, billing, alle App-Komponenten,
  Error-/Not-Found-Boundaries. ✅
- **Phase C — Marketing + Auth + Legal:** navbar (+ Toggle), hero (Glow entfernt),
  alle marketing/*, auth-form, login/signup/reset, legal-shell, pricing/features,
  global-error + opengraph-image. ✅
- **Polish:** Settings-Karten-Akzente auf Babyblau vereinheitlicht (Danger bleibt
  rot), tool-logos Fallback, theme-aware Navbar-Backdrop. ✅

> Ganzes `src` ist frei von alten Brand-Farben (per Grep verifiziert). Bewusste
> Ausnahme: offizielle Tool-Logo-SVGs behalten ihre Markenfarben.

> Alte Deko-Klassen (`.glass`, `.gradient-text`, …) sind in `globals.css` als
> token-basierte Shims erhalten, damit noch nicht migrierte Komponenten in
> beiden Themes nicht zerbrechen. Beim Migrieren durch echte Token-Utilities
> ersetzen.

---

## Finn's World — Atmosphäre & Markenwelt

PromptPrinter soll sich anfühlen wie eine ruhige, lichtdurchflutete Ozeanlandschaft
— **premium, kreativ, intelligent**, nicht wie ein SaaS-Template oder ein Kinderdesign.
Finn führt unauffällig durch die Seite. Technisch: monochrome Palette + Wasserblau-Akzent
+ seltene Korall-Tupfer, subtile Tiefen-Gradienten/Lichtquellen, viel Weißraum, schwebende
Bewegung. **Dark-Mode-First**, WCAG jederzeit (Text ≥ 4,5:1, `prefers-reduced-motion`).

### Manifesto — 10 Prinzipien (Kompass für jede Entscheidung)

1. **Ozean durch Licht, nicht Objekte** — Farbverläufe & Beleuchtung, keine Fische/Wellenmuster.
2. **Sonnenlicht statt Aquarium** — offenes, lichtdurchflutetes Wasser; kein Tiefsee-Diorama, keine Glaskiste. Licht von oben.
3. **Premium-Produkt mit Finn** — ernstzunehmende Software. Entfernt man Finn, wirkt die Seite immer noch seriös.
4. **Ein Akzent ist Wasser, Koralle das Feuer** — Babyblau allgegenwärtig & kühl; Koralle nur punktuell, nie im Standard-UI.
5. **Tiefe hat Richtung** — beim Scrollen sinnhaft tiefer: oben hell (Oberfläche), unten dunkler.
6. **Alles schwebt** — sanfte, „schwere" Feder-Physik, leicht verzögertes Aufkommen, nichts abruptes.
7. **Zurückhaltung ist Luxus** — Weißraum = offenes Wasser. Springt ein Effekt ins Auge, ist er zu stark.
8. **Warme Neutrals** — Creme statt reinem Weiß, erwärmtes Navy statt kühlem Schwarzblau.
9. **Biolumineszenz-Akzent** — Akzent/Licht wie lebendes Licht: sparsam, aber präsent (Fokus-Ring leuchtet sanft, nie Neon).
10. **Stimmung: ruhig – edel – intelligent – kreativ – vertrauenswürdig** — keine grellen oder albernen Elemente.

### Palette (Finn's World) — Ist vs. geplant

> ⚠️ Geshippt ist bislang **nur der Dark-Block (Phase 1)**. Alle Light-Werte sind
> **Zielwerte**, der `:root`-Block ist noch unverändert. `--accent-warm` existiert
> aktuell **nur in `.dark`** und wird **nirgends angewendet** (reserviert).

| Token | Light (`H S% L%`) | Dark (`H S% L%`) | Status / Rolle |
|---|---|---|---|
| `--background` | `40 24% 99.5%` | `208 20% 6%` | Dark ✅ live · Light geplant (Creme statt Weiß) |
| `--surface` | `206 24% 97%` | `208 16% 9%` | Dark ✅ · Light geplant |
| `--surface-raised` | `0 0% 100%` | `208 17% 12%` | Dark ✅ · Light unverändert |
| `--surface-hover` | `206 20% 95%` | `208 16% 15%` | Dark ✅ · Light geplant |
| `--shadow` | `210 44% 12%` (≈ `#11181F`, dunkles Blau, niedrige Alpha) | `208 25% 3%` | Dark ✅ · Light geplant |
| `--accent` (Wasser) | `203 79% 72%` | `204 80% 75%` | unverändert ✅ |
| `--accent-warm` (Koralle) | `14 84% 64%` | `12 88% 70%` | Dark ✅ definiert (nur `.dark`, ungenutzt) · Light geplant |

### Atmosphäre — erlaubt vs. verboten

| **Erlaubt** | **Verboten** |
|---|---|
| Dezente Licht-/Tiefen-Gradienten (oben hell → unten dunkel) | Fisch-/Wellen-Motive |
| Eine weiche Lichtquelle von oben (subtiler radialer Schein) | Aquarium-/Tank-/Glas-/Strand-Look |
| Großzügiger Weißraum (= offenes Wasser) | Übersättigte Verläufe, Neon, Glows, überladene Layer |
| Schwebende Bewegung mit Feder-Physik | Dauer-Blasen, wackelnde Korallen, Maus-Verfolgung |
| Ein lebendiger Babyblau-Akzent (fast biolumineszent) | Schiffe, Anker, Schatztruhen, Cartoon-Ästhetik |
| Konsistente Typo & Icon-Stile | Willkürliche Stil-/Größen-/Farbvielfalt |

### Bewegung & Reduced Motion

- Gemeinsame **„Finn-Physik"**: Spring-Easing (Richtwert `stiffness 30–50`, `damping 15–20`),
  Einblendungen ~0,6–0,8 s, immer dieselbe „Schwerkraft" für Konsistenz (Prinzip #6).
- `@media (prefers-reduced-motion: reduce)` schaltet **alle** nicht-essenziellen Animationen
  ab (statisch / Dauer 0) — Pflicht (WCAG 2.3.3).

### Umsetzungs-Roadmap

- **Phase 1 — Dark-Token-Kalibrierung ✅ abgeschlossen.** Dark-Neutrals auf Hue `208`
  vereint (Hue-only), `--accent-warm` reserviert. „Felt, not seen": Body-BG nur
  `rgb(12,14,18) → rgb(12,16,18)`. Light-Kalibrierung (Creme + Light-Koralle) steht aus.
- **Phase 2 — Ambienter Tiefen-Effekt + Motion-Physik (offen).** Subtiler Hintergrund-Gradient,
  **eine** weiche Lichtquelle, gemeinsame Spring-Konstante, biolumineszenter Fokus-Ring.
  Risiko: Performance (GPU-freundlich: opacity/transform statt schwerer Box-Shadows) + Subtilität.
- **Phase 3 — Optionale Immersion (offen, jeder Punkt streichbar).** Scroll-abhängige Tiefe,
  sehr schwache statische Kaustik-Textur, Koralle bei echten Höhepunkten, dezente Parallax/Hover-Licht.

### QA vor jedem Commit

Kontrast ≥ 4,5:1 (beide Themes) · No-Go-Liste eingehalten · `prefers-reduced-motion` greift ·
Mobile + Performance geprüft · `typecheck && lint && test && build` grün ·
Red-Carpet-Test: „Fühlt es sich ruhiger & tiefer an?" (ohne zu verraten, *was* anders ist).
