# Product

## Register

product

## Users
"Vibe-coders": people who build by feeding prompts into AI build tools (Lovable, Cursor,
v0, Claude Code, Bolt, Replit). Technical enough to paste a prompt into a build tool, and
paying for every wasted iteration in credits. On the Billing page specifically: an
already-signed-up user checking their plan, their usage against monthly limits, and whether
upgrading or adding their own API key (BYOK) changes anything for them.

## Product Purpose
PromptPrinter is a chat with an in-app mascot ("Finn") that makes the FIRST prompt into a
build tool count. Finn asks one bundled clarifying question covering the things the build
tool itself never asks (target tool, core screens, data model, auth, design direction), then
delivers one finished, paste-ready prompt tailored to that tool. The value is not burning
credits on iterations a complete prompt would have avoided.

A project can additionally carry files and a public GitHub repository, analysed once into a
"project brain" — after that every chat in the project already knows the stack (framework,
language, architecture, database, design system, coding style, conventions) without the user
explaining it.

Success on the Billing page: the user immediately understands their plan, how much of their
monthly allowance is used, and what changes if they upgrade or bring their own key, without
it reading like an empty template bolted onto the app.

> **Truth note (2026-08-04, plan item A-1).** Until now this section described "a complete,
> structured prompt/artifact packet (product plan, AI instructions, app design, database
> schema, security checklist, marketing)". That was the generation pipeline removed on
> 2026-07-17; the software has not produced artifact packets since. Same class of finding as
> the F-1 fix in the AGB — a document promising a capability the product does not have — at
> a place the earlier pass did not reach. Note the current numbers while here: Free is
> BYOK-only (zero server-key messages, 3 projects), Pro/Team are 400 messages per month.

## Brand Personality
"Refined Dev-Brand", closest real references are Linear, Vercel, and Raycast: monochrome
chrome, a single restrained accent (baby blue), flat surfaces with hairline borders instead
of glassmorphism, quiet confident typography (Geist Sans/Mono). Layered on top is "Finn's
World", a calm, light-filled ocean atmosphere (warm neutrals, one living accent, generous
whitespace, gentle floaty motion): premium, creative, intelligent, trustworthy. Finn is a
companion presence in the product, not a mascot pasted onto every screen.

## Anti-references
No generic SaaS-billing template: no matching-size plan cards with a gradient-text price, no
hero-metric-plus-sparkline blocks, no side-stripe colored borders on stat cards, no
glassmorphism or purple/neon gradients, no feature-grid of identical icon+heading+text tiles,
no corporate footer-style columns, no vaporware features ("priority queue" that was never
built). Nothing that reads as generated in one shot without a real design pass.

## Design Principles
1. Show the user's real relationship to their limits (usage vs. cap), not just a static
   price card, a billing page's job is orientation, not marketing.
2. Monochrome first, accent second, baby blue marks the one or two things that matter
   (active plan, primary action), it never decorates.
3. Cards are the lazy answer, prefer real layout and hierarchy over uniform bordered boxes
   wherever a card isn't earning its keep.
4. Whitespace and quiet typographic hierarchy over decoration ("Zurückhaltung ist Luxus").
5. Every element should still make sense with Finn removed, the design stands on its own as
   serious software, it doesn't lean on the mascot to feel alive.

## Accessibility & Inclusion
WCAG-oriented: text contrast ≥ 4.5:1, large UI/glyphs ≥ 3:1, always-visible focus rings
(`focus-visible:ring-2 ring-ring/50`), tap targets ≥ 44px, `prefers-reduced-motion` disables
all non-essential animation, both light and dark themes are tested (dark is the app default,
theme is a user preference in Settings).
