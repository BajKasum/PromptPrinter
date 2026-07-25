repo: BajKasum/PromptPrinter
branch: main
path: (whole repo)

## Last sync
date: 2026-07-25T15:20:00Z

### Updated in this project
- Built the full design system from scratch: tokens, 17 component families, and 5 interactive UI kits, grounded in both the local working copy and the GitHub repo.
- Corrected two stale color values in the pre-existing spec cards (`colors/`, `brand/finn.html`) that predated the repo's "Finn's World" ocean-blue calibration (`DESIGN.md`, 2026-07-22).
- Ported the product's real component set (`src/components/ui`, `src/components/brand`) 1:1 as dependency-free React components.

## Screen map
| Design system surface | Repo source |
|---|---|
| `components/core/*` | `src/components/ui/*` |
| `components/brand/*` | `src/components/brand/*` |
| `ui_kits/marketing` | `src/app/page.tsx`, `src/components/marketing/*` |
| `ui_kits/app-dashboard` | `src/components/app/sidebar.tsx`, `command-palette.tsx`, `app-header.tsx`, `src/app/(app)/layout.tsx` |
| `ui_kits/chat` | `src/components/app/chat-transcript.tsx`, `chat-result-panel.tsx`, `chat-composer.tsx` |
| `ui_kits/auth` | `src/components/auth/*` |
| `ui_kits/settings` | `src/components/app/settings-workspace.tsx`, `theme-preference.tsx`, `tool-picker.tsx` |
| `tokens/colors.css` | `src/app/globals.css` |
| `tokens/typography.css`, `tokens/spacing.css`, `tokens/radius.css` | `tailwind.config.ts` |
