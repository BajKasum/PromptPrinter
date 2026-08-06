/**
 * The wave that swims in under a hovered or current nav-style link — the
 * design system's water/bioluminescence motif (DESIGN.md, Manifesto #4 and
 * #9) doing the job a plain colour change was doing badly. Shared between the
 * navbar and the footer so both use the same hover language on their links.
 *
 * The reveal, the glow's timing and the reduced-motion fallback all live in
 * globals.css under `.nav-wave`; this only draws the shape and says whether
 * this link is the current page. No hooks, no state — safe in a server
 * component (the footer) as much as a client one (the navbar); `.group`/
 * `data-active` are plain CSS, not JS.
 *
 * The stroke is `accent-text`, not `accent`: the public site is always light,
 * and `--accent` is the light fill tone — measured at ~1.7:1 against both the
 * page and the pill behind it, i.e. a line you can barely see. DESIGN.md makes
 * the same call for accent text. The bloom around it still comes from
 * `--accent`, which is what makes it read as water-light rather than a hard
 * rule (Manifesto #9).
 */
export function NavWave({ active }: { active: boolean }) {
  return (
    <svg
      aria-hidden
      viewBox="0 0 36 8"
      fill="none"
      data-active={active}
      className="nav-wave pointer-events-none absolute bottom-[3px] left-1/2 h-2 w-9 -translate-x-1/2 text-accent-text drop-shadow-[0_0_3px_hsl(var(--accent)/0.75)]"
    >
      <path
        d="M1 5 Q 5.4 1.7, 9.7 5 T 18.3 5 T 26.8 5 T 35 5"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
      />
    </svg>
  );
}
