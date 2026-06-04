/**
 * Brand marks for every build-target tool the app offers. Each logo is an
 * inline SVG (no network assets, works server- or client-side) sized via the
 * `size` prop. `TOOL_VISUAL` carries the brand accent color and a one-line
 * blurb so the picker can tint each tile and describe the choice. Keys match
 * the strings in `TOOL_OPTIONS` exactly, so the picker can look them up 1:1.
 */

export type ToolVisual = { color: string; blurb: string };

export const TOOL_VISUAL: Record<string, ToolVisual> = {
  // master
  Claude: { color: "#D97757", blurb: "Stark für Prompts" },
  ChatGPT: { color: "#10A37F", blurb: "Strukturierte Outputs" },
  Gemini: { color: "#4285F4", blurb: "Recherche & Kontext" },
  // frontend
  Lovable: { color: "#FF7AA2", blurb: "Full-Stack aus Prompt" },
  Stitch: { color: "#00BFA6", blurb: "UI aus Text" },
  Figma: { color: "#A259FF", blurb: "Design-Handoff" },
  // backend
  "Claude Code": { color: "#D97757", blurb: "Agentisches Coding" },
  Cursor: { color: "#A1A1AA", blurb: "KI-Code-Editor" },
  Windsurf: { color: "#22D3EE", blurb: "Agentische IDE" },
  // database
  PostgreSQL: { color: "#5A9BD4", blurb: "Robustes SQL" },
  MySQL: { color: "#00A6C9", blurb: "Bewährtes SQL" },
  Supabase: { color: "#3ECF8E", blurb: "Postgres + Auth" },
};

export function toolVisual(name: string): ToolVisual {
  return TOOL_VISUAL[name] ?? { color: "#A78BFA", blurb: "Build-Tool" };
}

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
      // Anthropic sunburst — a dense star of tapered rays.
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

    case "Lovable":
      return (
        <svg {...common}>
          <defs>
            <linearGradient id={`tl-${uid}`} x1="3" y1="4" x2="20" y2="21" gradientUnits="userSpaceOnUse">
              <stop stopColor="#FF7AA2" />
              <stop offset="1" stopColor="#FF8E53" />
            </linearGradient>
          </defs>
          <path
            fill={`url(#tl-${uid})`}
            d="M12 20.6l-1.3-1.2C6.1 15.2 3.3 12.6 3.3 9.3 3.3 6.7 5.3 4.7 7.9 4.7c1.5 0 2.9.7 3.8 1.9.9-1.2 2.3-1.9 3.8-1.9 2.6 0 4.6 2 4.6 4.6 0 3.3-2.8 5.9-7.4 10.1L12 20.6z"
          />
        </svg>
      );

    case "Stitch":
      // Sewing needle threading a curved stitch.
      return (
        <svg {...common}>
          <g stroke="#00BFA6" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" fill="none">
            <path d="M4.5 19.5 14 10" />
            <path d="M14 10l5-5" />
            <path d="M4.5 19.5c-1.6-1.6.1-3.7 2-2.9" />
            <ellipse cx="15.6" cy="8.4" rx="1.7" ry="0.9" transform="rotate(-45 15.6 8.4)" />
          </g>
        </svg>
      );

    case "Figma":
      return (
        <svg {...common}>
          <path d="M8 24a4 4 0 0 0 4-4v-4H8a4 4 0 1 0 0 8z" fill="#0ACF83" />
          <path d="M4 12a4 4 0 0 1 4-4h4v8H8a4 4 0 0 1-4-4z" fill="#A259FF" />
          <path d="M4 4a4 4 0 0 1 4-4h4v8H8a4 4 0 0 1-4-4z" fill="#F24E1E" />
          <path d="M12 0h4a4 4 0 0 1 0 8h-4V0z" fill="#FF7262" />
          <path d="M20 12a4 4 0 1 1-8 0 4 4 0 0 1 8 0z" fill="#1ABCFE" />
        </svg>
      );

    case "Claude Code":
      // Terminal tinted in Anthropic clay.
      return (
        <svg {...common}>
          <rect x="2.5" y="4.5" width="19" height="15" rx="3" stroke="#D97757" strokeWidth="1.6" />
          <path d="M7 10l3 2-3 2" stroke="#D97757" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
          <path d="M12.5 15h4.5" stroke="#D97757" strokeWidth="1.6" strokeLinecap="round" />
        </svg>
      );

    case "Cursor":
      return (
        <svg {...common}>
          <defs>
            <linearGradient id={`tl-${uid}`} x1="5" y1="3" x2="18" y2="20" gradientUnits="userSpaceOnUse">
              <stop stopColor="#fff" />
              <stop offset="1" stopColor="#9CA3AF" />
            </linearGradient>
          </defs>
          <path
            fill={`url(#tl-${uid})`}
            d="M5 3.2 19.4 10c.7.3.6 1.3-.1 1.5l-5.5 1.6-2.6 5.2c-.3.7-1.4.6-1.6-.2L4.9 3.9c-.1-.5.4-.9.1-.7z"
          />
        </svg>
      );

    case "Windsurf":
      return (
        <svg {...common}>
          <defs>
            <linearGradient id={`tl-${uid}`} x1="6" y1="3" x2="18" y2="18" gradientUnits="userSpaceOnUse">
              <stop stopColor="#5EEAD4" />
              <stop offset="1" stopColor="#0EA5E9" />
            </linearGradient>
          </defs>
          <path fill={`url(#tl-${uid})`} d="M12 2.5c3.7 2.2 5.7 6 5.9 11.5H6.1C6.3 8.5 8.3 4.7 12 2.5z" />
          <path d="M12 2.5V18" stroke="#0EA5E9" strokeWidth="1.4" strokeLinecap="round" />
          <path d="M4.5 18.5c2 1.3 3.5 1.3 5.5 0s3.5-1.3 5.5 0 3.5 1.3 5.5 0" stroke={`url(#tl-${uid})`} strokeWidth="1.6" strokeLinecap="round" fill="none" />
        </svg>
      );

    case "PostgreSQL":
      // Stylized elephant head — Postgres blue.
      return (
        <svg {...common}>
          <path
            fill="#5A9BD4"
            d="M8 3.5C5.2 3.5 3 5.7 3 8.5c0 1.7.8 3.2 2.1 4.1V18a1.5 1.5 0 0 0 3 0v-2.2h1.3V18a1.5 1.5 0 0 0 3 0v-2.6c.5-.2.9-.4 1.3-.7.5.9 1.4 1.3 2.3 1.3v-2c-.5 0-.9-.4-.9-.9v-2.7c0-3.3-2.6-5.9-5.8-5.9H8z"
          />
          <path
            fill="#5A9BD4"
            d="M5.2 12.2c-1 .6-1.6 1.7-1.6 2.9V18a1.4 1.4 0 0 0 2.8 0v-3.1"
          />
          <circle cx="8.2" cy="8" r="0.95" fill="#0A0A0A" />
          <path d="M11.5 6c1.5 0 2.6 1.1 2.6 2.6" stroke="#3D7AB3" strokeWidth="1.2" strokeLinecap="round" fill="none" />
        </svg>
      );

    case "MySQL":
      // Leaping dolphin — MySQL teal with an orange ripple.
      return (
        <svg {...common}>
          <path
            fill="#00A6C9"
            d="M3 13.6c3 1 5.3.2 7.3-1.8 1.4-1.4 3-2.8 5.6-2.9-.8 1.2-.8 2.2-.3 3.1 1.4-1 2.4-2.1 2.9-3.2.4 3.4-1.8 7.2-6.1 7.2-2.5 0-4.2-.7-5.5-1.6-1.2.2-2.4.7-3.3 1.4L3 13.6z"
          />
          <path fill="#00A6C9" d="M13 9.6c.4-1.9 1.8-3.1 3.9-3.3-.9.9-1 2-.8 3.2" />
          <circle cx="8.6" cy="11.3" r="0.7" fill="#fff" />
          <path d="M4 16.4c2.1.9 4.2.9 6.3 0" stroke="#F29111" strokeWidth="1.3" strokeLinecap="round" fill="none" />
        </svg>
      );

    case "Supabase":
      return (
        <svg {...common}>
          <defs>
            <linearGradient id={`tl-${uid}`} x1="6" y1="2" x2="16" y2="22" gradientUnits="userSpaceOnUse">
              <stop stopColor="#3ECF8E" />
              <stop offset="1" stopColor="#1B8F5E" />
            </linearGradient>
          </defs>
          <path
            fill={`url(#tl-${uid})`}
            d="M12.6 2.3 4.3 12.9c-.5.6-.1 1.6.7 1.6h6.1l-.9 7.1c-.1.8 1 1.2 1.5.6l8.3-10.6c.5-.6.1-1.6-.7-1.6h-6.1l.9-7.1c.1-.8-1-1.2-1.5-.6z"
          />
        </svg>
      );

    default:
      // Generic spark fallback so an unknown tool never renders blank.
      return (
        <svg {...common}>
          <path
            fill="#A78BFA"
            d="M12 2.5c.4 4.7 3.8 8.1 8.5 8.5-4.7.4-8.1 3.8-8.5 8.5-.4-4.7-3.8-8.1-8.5-8.5 4.7-.4 8.1-3.8 8.5-8.5z"
          />
        </svg>
      );
  }
}
