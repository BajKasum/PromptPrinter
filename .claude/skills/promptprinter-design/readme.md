# PromptPrinter Design System

**PromptPrinter** turns a rough app idea into a complete, structured, build-ready prompt package (product plan, AI instructions, app design, database schema, security checklist) through a guided chat with an in-app dolphin mascot, **Finn**. The audience is solo/indie developers and "vibe-coders" — technical enough to paste a prompt into Claude, ChatGPT, Cursor, Lovable or Stitch, not looking to write the scaffolding prose themselves. The product and all UI copy are German-first (`lang="de"`).

Brand direction: **"Refined Dev-Brand"** — closest real references are **Linear, Vercel, and Raycast**: monochrome chrome, a single restrained accent (baby blue), flat surfaces with hairline borders instead of glassmorphism, quiet confident typography (Geist Sans/Mono). Layered on top is **"Finn's World"**: a calm, light-filled ocean atmosphere (sky-blue by day, deep ocean-blue by night, one living accent, generous whitespace, gentle floaty motion). Premium, creative, intelligent, trustworthy — never a SaaS template, never a children's app.

## Sources

This system was built by reading the product's own Next.js codebase directly (both a locally-attached copy and its GitHub repo, `BajKasum/PromptPrinter`, branch `main` — see `github.md`), not from screenshots. Primary references: `src/app/globals.css` + `tailwind.config.ts` (tokens), `DESIGN.md` (visual system + "Finn's World" manifesto), `MASCOT.md` (the 14-state mascot system), `PRODUCT.md` (brand personality + anti-references), and every component under `src/components/ui`, `src/components/brand`, `src/components/marketing`, `src/components/app`, `src/components/auth`.

## Content Fundamentals

- **Voice:** Finn speaks in first person ("**Ich** wandle deine Idee um", never "PromptPrinter wandelt..."). Copy is warm, calm, competent — a build-buddy beside you, never a lecturing teacher or a nagging Clippy. Casual "du", short sentences, a hint of humor.
- **No jargon on the public site.** Words like PRD, Blueprint, Schema, Long-Context, Artefakt are cut from marketing copy (allowed in-app and in the FAQ where precision matters).
- **No SaaS-template patterns.** DESIGN.md explicitly bans: identical-size feature-grid tiles, numbered cards, corporate four-column footers, status-pulse indicators. PRODUCT.md adds: no gradient-text pricing, no hero-metric-plus-sparkline blocks, no colored left-border "stripe" stat cards, no vaporware features.
- **Whitespace is intentional.** Less structure reads as more emotional impact; a tighter rhythm reads as more emotion (the "Litany" principle).
- **Emoji:** never as icons in the UI (Lucide only, see Iconography). Emoji-as-mascot-shorthand appears only in this design system's own reference cards (e.g. the brand journey map), never in real product copy.

## Visual Foundations

- **Color:** monochrome chrome (background/foreground/surface/border) + exactly **one** accent — baby blue (`--accent`) — used for links, active nav, focus rings, selection, and the occasional brand moment. A reserved warm coral (`--accent-warm`) exists in both themes but is **never applied** anywhere yet — it's saved for genuine celebration moments (Phase 3 on the product roadmap). Both themes are a deliberately-blue "Finn's World": light mode is a bright sky-blue (hue 205), dark mode a deep saturated ocean-blue (hue 213) — neither is neutral gray or pure white/black. See `tokens/colors.css` and the Colors cards.
- **Type:** Geist Sans (UI/body) + Geist Mono (labels, uppercase caps, tabular numbers, code) — both load from Google Fonts in `tokens/typography.css`. A 13-step scale from `display-2xl` (72px) down to `code` (13.5px mono), see `typography/scale.html`.
- **Radius:** tight and IDE-like — 6/8/10/12/16/20px + full pill. Never a heavy 24px+ "app icon" rounding.
- **Elevation:** flat surfaces + a 1px hairline border do almost all the work; box-shadow is very subtle (`shadow-card`, `shadow-elevated`) and cool-tinted (never neutral black). No glassmorphism as a primary surface — `.glass`/`.glass-strong` exist as transitional utilities on a couple of legacy decorative spots only.
- **Motion:** "Finn-Physik" — calm spring easing, 150–300ms micro-interactions, 0.6–0.8s entrances, never hectic, never more than one moving mascot per viewport. `prefers-reduced-motion` disables every non-essential animation globally (`tokens/motion.css`), not per-component.
- **Focus states:** a "bioluminescent" glow — a crisp accent ring plus a soft bloom just outside it (`box-shadow`, GPU-cheap) — never a flat default outline, never neon.
- **Backgrounds:** one soft, fixed light source from above (`.finn-atmosphere`) on the landing page only — sunlit open water, not an aquarium. No wave/fish motifs, no bubbles-as-wallpaper, no parallax mouse-tracking.
- **Imagery:** no photography in the product; the only imagery is Finn's own artwork (transparent PNGs). Placeholder needed anywhere real photography would go? Ask — none exists in the source.

## Iconography

The product uses **Lucide** (SVG icons, ~1.8 stroke width, no fill, consistent stroke-only style) — never emoji as functional icons. This design system's `Icon` component (`components/core/icon/`) is a small, **dependency-free** hand-authored line-icon set in that same visual language (no npm/CDN dependency inside a component file, per this system's authoring rules) — it covers the icons the components and UI kits actually use, not the full Lucide catalog. A project already depending on real Lucide can keep using it directly; treat `Icon` as this system's portable subset. Provider brand marks (`ToolLogo`) are the deliberate exception: they keep their real hex colors and exact shapes, copied from the product's own `tool-logos.tsx`.

No separate logo file exists in the source — the brand mark **is** `assets/mascot/dolphin.png`; the wordmark is always live text (see `components/brand/logo/`).

## Finn, the Mascot

Finn is a dolphin guide with **14 states** (idle, welcoming, curious, listening, thinking, researching, building, organizing, explaining, delivering, celebrating, helping, waiting, sad), each with its own artwork and idle-motion preset. One Finn per viewport, always — he reinforces content, never replaces it ("removing Finn, the page should still read as serious software" — PRODUCT.md, DESIGN.md). Full state-by-state rationale and the section-by-section landing-page journey: `brand/finn.html` and the original `MASCOT.md`.

## Index

- **`styles.css`** — root stylesheet (import list only). Everything under `tokens/` flows through it.
- **`tokens/`** — `colors.css`, `typography.css` (+ Google Fonts import), `spacing.css`, `radius.css`, `shadows.css`, `motion.css`. Reference cards: `colors/palette-light.html`, `colors/palette-dark.html`, `typography/scale.html`, `tokens/spacing-radius.html`.
- **`brand/finn.html`** — the mascot system, brand voice rules, and the landing-page Finn journey.
- **`assets/mascot/`** — all 16 source PNGs (14 states + 2 legacy filenames kept for reference).
- **`components/core/`** — Button, Card, Input/Label/PasswordInput, Badge/PlanBadge, Skeleton, Icon.
- **`components/feedback/`** — ToastProvider/useToast, UsageMeter.
- **`components/navigation/`** — MenuToggleIcon.
- **`components/brand/`** — Mascot/AnimatedMascot, DolphinLoader, SuccessCelebration, Floaters, Logo/LogoMark, ToolLogo.
- **`ui_kits/`** — five interactive full-surface recreations: `marketing` (landing page), `app-dashboard` (sidebar + Chats/Projekte), `chat` (conversation + result panel), `auth` (login/signup), `settings`.
- **`SKILL.md`** — portable skill file for using this system elsewhere (e.g. Claude Code).
- **`github.md`** — the linked source repo and sync history.

## Intentional additions

- **`Icon`** — the product has no single reusable icon component (Lucide is called ad hoc); this wraps a curated subset so every other component here stays dependency-free.
- **`Badge`** — the product's `.chip` utility class, promoted to a real component since three different screens use the exact same pattern.

## Caveats — please help me iterate

- Fonts load via a Google Fonts `@import` (the product actually self-hosts Geist via `next/font`). If you'd like pixel-identical metrics/OpenType features, drop the two woff2 files in and I'll switch `tokens/typography.css` to `@font-face`.
- The Hero's scroll-scrubbed GSAP spine and the elaborate typed/staged prompt-demo animation are simplified to a lighter click-to-switch interaction in `ui_kits/marketing` — a cosmetic recreation, not a port of the animation engine.
- I have not yet built dedicated screens for onboarding tour, billing, library/file browser, or the legal/docs pages — say the word and I'll add UI kits for any of them.
