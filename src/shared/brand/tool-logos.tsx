/**
 * Brand marks for the AI providers BYOK offers a key for (api-keys.tsx). Each
 * logo is an inline SVG (no network assets, works server- or client-side)
 * sized via the `size` prop.
 *
 * The raw hex values throughout this file are a deliberate, blanket exception
 * to CLAUDE.md's "no raw hex, only semantic tokens" rule (QA finding C-3):
 * these are third-party brand colors (Claude's terracotta, ChatGPT's green, …),
 * fixed identity marks that must render the same regardless of the app's own
 * light/dark theme — a design token would be the wrong tool here, not a
 * missed one. auth/oauth-buttons.tsx is the only other file with the same
 * exception, for the same reason (Google/GitHub brand marks).
 *
 * M-18 (Audit 06.09.2026): this file used to carry nine more cases (Lovable,
 * Stitch, Figma, Claude Code, Cursor, Windsurf, PostgreSQL, MySQL, Supabase)
 * plus a TOOL_VISUAL/toolVisual export, all built for the "Standard-Tools"
 * settings picker. That picker is gone (settings-workspace.tsx) and nothing
 * else ever called toolVisual or looked up those nine names, so they went
 * with it rather than sit here unreachable.
 */

export function ToolLogo({ name, size = 18 }: { name: string; size?: number }) {
  const common = {
    width: size,
    height: size,
    viewBox: "0 0 24 24",
    fill: "none" as const,
    xmlns: "http://www.w3.org/2000/svg",
    "aria-hidden": true,
  };
  const uid = name.replace(/[^a-z0-9]/gi, "").toLowerCase();

  switch (name) {
    case "Claude":
      // Anthropic sunburst, a dense star of tapered rays.
      return (
        <svg {...common}>
          <g stroke="#D97757" strokeWidth="1.5" strokeLinecap="round">
            <line x1="12" y1="2.5" x2="12" y2="21.5" />
            <line x1="2.5" y1="12" x2="21.5" y2="12" />
            <line x1="5.3" y1="5.3" x2="18.7" y2="18.7" />
            <line x1="18.7" y1="5.3" x2="5.3" y2="18.7" />
            <line x1="8.2" y1="3.6" x2="15.8" y2="20.4" strokeWidth="1.1" />
            <line x1="20.4" y1="8.2" x2="3.6" y2="15.8" strokeWidth="1.1" />
            <line x1="15.8" y1="3.6" x2="8.2" y2="20.4" strokeWidth="1.1" />
            <line x1="20.4" y1="15.8" x2="3.6" y2="8.2" strokeWidth="1.1" />
          </g>
        </svg>
      );

    case "ChatGPT":
      // OpenAI interlocked knot.
      return (
        <svg {...common}>
          <path
            fill="#10A37F"
            d="M21.55 10.04a5.42 5.42 0 0 0-.47-4.46 5.5 5.5 0 0 0-5.92-2.64 5.43 5.43 0 0 0-4.1-1.84 5.5 5.5 0 0 0-5.24 3.8 5.43 5.43 0 0 0-3.63 2.63 5.5 5.5 0 0 0 .68 6.45 5.42 5.42 0 0 0 .47 4.46 5.5 5.5 0 0 0 5.92 2.64 5.42 5.42 0 0 0 4.1 1.84 5.5 5.5 0 0 0 5.24-3.81 5.43 5.43 0 0 0 3.63-2.63 5.5 5.5 0 0 0-.68-6.44zm-8.2 11.45a4.07 4.07 0 0 1-2.62-.95l.13-.07 4.35-2.51a.71.71 0 0 0 .36-.62v-6.13l1.84 1.07a.07.07 0 0 1 .03.05v5.08a4.1 4.1 0 0 1-4.09 4.08zm-8.79-3.75a4.07 4.07 0 0 1-.49-2.74l.13.08 4.35 2.51a.71.71 0 0 0 .71 0l5.31-3.06v2.12a.07.07 0 0 1-.02.06l-4.4 2.54a4.1 4.1 0 0 1-5.6-1.5zM3.62 8.1a4.07 4.07 0 0 1 2.13-1.79v5.17a.71.71 0 0 0 .35.62l5.31 3.06-1.84 1.07a.07.07 0 0 1-.06 0l-4.4-2.54a4.1 4.1 0 0 1-1.5-5.6zm15.1 3.51-5.31-3.07 1.84-1.06a.07.07 0 0 1 .06 0l4.4 2.54a4.09 4.09 0 0 1-.62 7.38v-5.17a.71.71 0 0 0-.36-.62zm1.83-2.76-.13-.08-4.34-2.53a.71.71 0 0 0-.72 0L11.38 9.3V7.18a.07.07 0 0 1 .02-.06l4.4-2.54a4.09 4.09 0 0 1 6.07 4.24zm-11.5 3.79-1.84-1.06a.07.07 0 0 1-.03-.06V6.43a4.09 4.09 0 0 1 6.7-3.14l-.13.07-4.35 2.51a.71.71 0 0 0-.36.62zl.01 6.18zm1-2.15 2.36-1.36 2.37 1.36v2.73l-2.36 1.36-2.37-1.36z"
          />
        </svg>
      );

    case "Gemini":
      return (
        <svg {...common}>
          <defs>
            <linearGradient id={`tl-${uid}`} x1="2" y1="3" x2="22" y2="21" gradientUnits="userSpaceOnUse">
              <stop stopColor="#4285F4" />
              <stop offset="0.5" stopColor="#9B72CB" />
              <stop offset="1" stopColor="#D96570" />
            </linearGradient>
          </defs>
          <path
            fill={`url(#tl-${uid})`}
            d="M12 2c.5 5.3 4.4 9.2 9.7 9.7v.6c-5.3.5-9.2 4.4-9.7 9.7h-.6c-.5-5.3-4.4-9.2-9.7-9.7v-.6C7 11.2 10.9 7.3 11.4 2h.6z"
          />
        </svg>
      );

    default:
      // Generic spark fallback so an unknown tool never renders blank.
      return (
        <svg {...common}>
          <path
            fill="#8FCDF2"
            d="M12 2.5c.4 4.7 3.8 8.1 8.5 8.5-4.7.4-8.1 3.8-8.5 8.5-.4-4.7-3.8-8.1-8.5-8.5 4.7-.4 8.1-3.8 8.5-8.5z"
          />
        </svg>
      );
  }
}
