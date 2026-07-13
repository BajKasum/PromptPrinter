# Product

## Register

product

## Users
Solo/indie developers and "vibe-coders" — people with a rough product idea who want a
build-ready prompt package for AI coding tools (Claude, ChatGPT, Cursor, Lovable, Stitch).
Technical enough to paste a prompt into a coding assistant, not looking to write the
scaffolding prose themselves. On the Billing page specifically: an already-signed-up user
checking their plan, their usage against monthly limits, and whether upgrading or adding
their own API key (BYOK) changes anything for them.

## Product Purpose
PromptPrinter turns a rough idea into a complete, structured prompt/artifact packet
(product plan, AI instructions, app design, database schema, security checklist, marketing)
via a guided chat with an in-app mascot ("Finn"). Success on the Billing page: the user
immediately understands their plan, how much of their monthly allowance is used, and what
changes if they upgrade or bring their own key — without it reading like an empty template
bolted onto the app.

## Brand Personality
"Refined Dev-Brand" — closest real references are Linear, Vercel, and Raycast: monochrome
chrome, a single restrained accent (baby blue), flat surfaces with hairline borders instead
of glassmorphism, quiet confident typography (Geist Sans/Mono). Layered on top is "Finn's
World" — a calm, light-filled ocean atmosphere (warm neutrals, one living accent, generous
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
   price card — a billing page's job is orientation, not marketing.
2. Monochrome first, accent second — baby blue marks the one or two things that matter
   (active plan, primary action), it never decorates.
3. Cards are the lazy answer — prefer real layout and hierarchy over uniform bordered boxes
   wherever a card isn't earning its keep.
4. Whitespace and quiet typographic hierarchy over decoration ("Zurückhaltung ist Luxus").
5. Every element should still make sense with Finn removed — the design stands on its own as
   serious software, it doesn't lean on the mascot to feel alive.

## Accessibility & Inclusion
WCAG-oriented: text contrast ≥ 4.5:1, large UI/glyphs ≥ 3:1, always-visible focus rings
(`focus-visible:ring-2 ring-ring/50`), tap targets ≥ 44px, `prefers-reduced-motion` disables
all non-essential animation, both light and dark themes are tested (dark is the app default,
theme is a user preference in Settings).
