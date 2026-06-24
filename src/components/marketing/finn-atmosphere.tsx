/**
 * Finn's World — ambient depth layer (Phase 2).
 *
 * A single fixed, non-interactive background behind the landing content: one
 * soft light from above + a gentle depth gradient (lighter top, deeper bottom).
 * Pure CSS, theme-driven via the `.dark` class — no JS, no animation, so it is
 * reduced-motion-safe by nature and composited once (cheap on scroll).
 *
 * Styling lives in globals.css under `.finn-atmosphere`. Scoped to the landing
 * surface for now (rendered in app/page.tsx), not the logged-in app or auth.
 */
export function FinnAtmosphere() {
  return <div aria-hidden className="finn-atmosphere" />;
}
