import React from "react";

/*
 * Small dependency-free line-icon set in the product's stroke style
 * (~1.8 stroke, round caps/joins, 24x24). The product itself uses Lucide
 * (see readme.md → Iconography); these are hand-authored equivalents so
 * every component here stays free of npm/CDN icon dependencies. Swap in
 * real Lucide (or another set) in production if you already depend on it.
 */
const PATHS = {
  check: '<path d="M20 6 9 17l-5-5"/>',
  x: '<path d="M18 6 6 18M6 6l12 12"/>',
  plus: '<path d="M12 5v14M5 12h14"/>',
  "chevron-down": '<path d="m6 9 6 6 6-6"/>',
  "chevron-right": '<path d="m9 18 6-6-6-6"/>',
  "arrow-right": '<path d="M5 12h14M13 5l7 7-7 7"/>',
  "corner-down-left": '<path d="M9 10 4 15l5 5"/><path d="M20 4v7a4 4 0 0 1-4 4H4"/>',
  search: '<circle cx="11" cy="11" r="7"/><path d="m21 21-4.3-4.3"/>',
  star: '<path d="M12 2.5l2.9 6.1 6.6.9-4.8 4.7 1.1 6.6-5.8-3.1-5.8 3.1 1.1-6.6-4.8-4.7 6.6-.9z"/>',
  copy: '<rect x="9" y="9" width="12" height="12" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>',
  download: '<path d="M12 3v12m0 0-4.5-4.5M12 15l4.5-4.5"/><path d="M4 17v2a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-2"/>',
  send: '<path d="M22 2 11 13"/><path d="M22 2 15 22l-4-9-9-4z"/>',
  square: '<rect x="5" y="5" width="14" height="14" rx="2"/>',
  info: '<circle cx="12" cy="12" r="9"/><path d="M12 16v-5"/><path d="M12 8h.01"/>',
  eye: '<path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7Z"/><circle cx="12" cy="12" r="3"/>',
  "eye-off": '<path d="M3 3l18 18"/><path d="M10.6 5.1A9.6 9.6 0 0 1 12 5c6.5 0 10 7 10 7a13.2 13.2 0 0 1-3.1 3.9M6.6 6.6C3.8 8.3 2 12 2 12s3.5 7 10 7a9.6 9.6 0 0 0 4.4-1"/><path d="M9.5 9.5a3 3 0 0 0 4.24 4.24"/>',
  loader: '<path d="M12 2v4"/><path d="m16.9 7.1 2.8-2.8"/><path d="M18 12h4"/><path d="m16.9 16.9 2.8 2.8"/><path d="M12 18v4"/><path d="m4.3 19.7 2.8-2.8"/><path d="M2 12h4"/><path d="m4.3 4.3 2.8 2.8"/>',
  "log-out": '<path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><path d="M16 17l5-5-5-5"/><path d="M21 12H9"/>',
  menu: '<path d="M4 6h16M4 12h16M4 18h16"/>',
  "panel-left-close": '<rect x="3" y="4" width="18" height="16" rx="2"/><path d="M9 4v16"/><path d="m14 10-2 2 2 2"/>',
  "panel-left-open": '<rect x="3" y="4" width="18" height="16" rx="2"/><path d="M9 4v16"/><path d="m13 10 2 2-2 2"/>',
  "folder-kanban": '<path d="M4 5a2 2 0 0 1 2-2h3.5l2 2H18a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2Z"/><path d="M8 12v3M12 10v5M16 12v3"/>',
  "folder-plus": '<path d="M4 5a2 2 0 0 1 2-2h3.5l2 2H18a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2Z"/><path d="M12 10v5M9.5 12.5h5"/>',
  "message-square": '<path d="M4 4h16v12H8l-4 4Z"/>',
  "messages-square": '<path d="M14 4H4v10l3-2.2V4"/><path d="M8 8h12v9l-3-2H8Z"/>',
  clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 3"/>',
  sparkles: '<path d="M12 3v4M12 17v4M3 12h4M17 12h4"/><path d="m6.5 6.5 2 2M15.5 15.5l2 2M6.5 17.5l2-2M15.5 8.5l2-2"/>',
  target: '<circle cx="12" cy="12" r="8"/><circle cx="12" cy="12" r="4"/><circle cx="12" cy="12" r="0.6" fill="currentColor"/>',
  "key-round": '<circle cx="8" cy="15" r="4"/><path d="M10.8 12.2 19 4M16 8l2.5 2.5M19 4l2 2-3 3"/>',
  lock: '<rect x="4" y="11" width="16" height="9" rx="2"/><path d="M8 11V7a4 4 0 0 1 8 0v4"/>',
  user: '<circle cx="12" cy="8" r="4"/><path d="M4 20c1.5-4 5-6 8-6s6.5 2 8 6"/>',
  building2: '<rect x="4" y="3" width="9" height="18"/><rect x="15" y="9" width="5" height="12"/><path d="M7 7h1M7 11h1M7 15h1M17 13h1M17 17h1"/>',
  gauge: '<circle cx="12" cy="13" r="8"/><path d="M12 13 15.5 9M8 13a4 4 0 0 1 8 0"/>',
  "shield-alert": '<path d="M12 3 4 6v6c0 4.5 3.2 7.7 8 9 4.8-1.3 8-4.5 8-9V6Z"/><path d="M12 8v4"/><path d="M12 16h.01"/>',
  compass: '<circle cx="12" cy="12" r="9"/><path d="m15 9-2 6-6 2 2-6z"/>',
  sun: '<circle cx="12" cy="12" r="4"/><path d="M12 3v2M12 19v2M4.2 4.2l1.4 1.4M18.4 18.4l1.4 1.4M3 12h2M19 12h2M4.2 19.8l1.4-1.4M18.4 5.6l1.4-1.4"/>',
  moon: '<path d="M20 14.5A8.5 8.5 0 0 1 9.5 4 8.5 8.5 0 1 0 20 14.5Z"/>',
  monitor: '<rect x="3" y="4" width="18" height="12" rx="2"/><path d="M8 20h8M12 16v4"/>',
  pencil: '<path d="m17 3 4 4L7 21H3v-4Z"/>',
  database: '<ellipse cx="12" cy="5.5" rx="8" ry="2.8"/><path d="M4 5.5V12c0 1.5 3.6 2.8 8 2.8s8-1.3 8-2.8V5.5"/><path d="M4 12v6.5c0 1.5 3.6 2.8 8 2.8s8-1.3 8-2.8V12"/>',
  "layout-template": '<rect x="3" y="4" width="18" height="6" rx="1.5"/><rect x="3" y="13" width="8" height="7" rx="1.5"/><rect x="13" y="13" width="8" height="7" rx="1.5"/>',
  "terminal-square": '<rect x="3" y="4" width="18" height="16" rx="2"/><path d="m8 10 2.5 2.5L8 15"/><path d="M13 15h3"/>',
  "arrow-up-right": '<path d="M7 17 17 7M9 7h8v8"/>',
  "sun-moon": '<path d="M12 8a2.8 2.8 0 1 0 2.8 2.8"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2"/>',
};

/**
 * Small line-icon renderer. Pass `name` (kebab-case) and optional `size` /
 * `strokeWidth` / `className` / `style`; unknown names render nothing.
 */
export function Icon({ name, size = 16, strokeWidth = 1.8, className, style, title }) {
  const inner = PATHS[name];
  if (!inner) return null;
  const spin = name === "loader";
  return React.createElement("svg", {
    width: size,
    height: size,
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth,
    strokeLinecap: "round",
    strokeLinejoin: "round",
    className,
    "aria-hidden": title ? undefined : true,
    role: title ? "img" : undefined,
    style: spin ? { animation: "pp-icon-spin 0.9s linear infinite", ...style } : style,
    dangerouslySetInnerHTML: { __html: (title ? `<title>${title}</title>` : "") + inner },
  });
}

// Injected once per mount; harmless if duplicated across instances.
export function IconSpinKeyframes() {
  return React.createElement(
    "style",
    null,
    "@keyframes pp-icon-spin{to{transform:rotate(360deg)}}"
  );
}

export const ICON_NAMES = Object.keys(PATHS);
