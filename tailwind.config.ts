import type { Config } from "tailwindcss";

/**
 * Token-driven theme. Every color resolves to a CSS variable defined in
 * globals.css (`:root` = light, `.dark` = dark), so light/dark flip from one
 * place. Channels are stored HSL (`H S% L%`) so Tailwind's `<alpha-value>`
 * opacity modifiers keep working (e.g. `bg-accent/10`, `ring-ring/40`).
 *
 * Color roles (Refined Dev-Brand):
 *   - background / foreground / surface / border : monochrome chrome
 *   - primary                                    : monochrome CTA (black↔white)
 *   - accent                                      : baby blue — links, active
 *     nav, focus, highlights, selection, brand moments
 */
const config: Config = {
  darkMode: "class",
  content: ["./src/**/*.{ts,tsx,mdx}"],
  theme: {
    extend: {
      colors: {
        background: "hsl(var(--background) / <alpha-value>)",
        foreground: "hsl(var(--foreground) / <alpha-value>)",
        surface: {
          DEFAULT: "hsl(var(--surface) / <alpha-value>)",
          raised: "hsl(var(--surface-raised) / <alpha-value>)",
          hover: "hsl(var(--surface-hover) / <alpha-value>)",
        },
        border: {
          DEFAULT: "hsl(var(--border) / <alpha-value>)",
          strong: "hsl(var(--border-strong) / <alpha-value>)",
        },
        muted: {
          DEFAULT: "hsl(var(--surface) / <alpha-value>)",
          foreground: "hsl(var(--muted-foreground) / <alpha-value>)",
        },
        primary: {
          DEFAULT: "hsl(var(--primary) / <alpha-value>)",
          foreground: "hsl(var(--primary-foreground) / <alpha-value>)",
        },
        accent: {
          DEFAULT: "hsl(var(--accent) / <alpha-value>)",
          foreground: "hsl(var(--accent-foreground) / <alpha-value>)",
          text: "hsl(var(--accent-text) / <alpha-value>)",
          subtle: "hsl(var(--accent-subtle) / <alpha-value>)",
        },
        ring: "hsl(var(--ring) / <alpha-value>)",
        destructive: {
          DEFAULT: "hsl(var(--destructive) / <alpha-value>)",
          foreground: "hsl(var(--destructive-foreground) / <alpha-value>)",
        },
        success: {
          DEFAULT: "hsl(var(--success) / <alpha-value>)",
          foreground: "hsl(var(--success-foreground) / <alpha-value>)",
        },
        warning: {
          DEFAULT: "hsl(var(--warning) / <alpha-value>)",
          foreground: "hsl(var(--warning-foreground) / <alpha-value>)",
        },
      },
      fontFamily: {
        sans: ["var(--font-geist-sans)", "Geist", "system-ui", "sans-serif"],
        mono: ["var(--font-geist-mono)", "Geist Mono", "ui-monospace", "monospace"],
      },
      fontSize: {
        "display-2xl": ["72px", { lineHeight: "1.05", letterSpacing: "-0.04em", fontWeight: "700" }],
        "display-xl": ["60px", { lineHeight: "1.05", letterSpacing: "-0.04em", fontWeight: "700" }],
        "display-lg": ["48px", { lineHeight: "1.1", letterSpacing: "-0.03em", fontWeight: "700" }],
        "display-md": ["36px", { lineHeight: "1.15", letterSpacing: "-0.02em", fontWeight: "700" }],
        "headline-lg": ["32px", { lineHeight: "1.2", letterSpacing: "-0.02em", fontWeight: "600" }],
        "headline-md": ["24px", { lineHeight: "1.3", letterSpacing: "-0.02em", fontWeight: "600" }],
        "headline-sm": ["20px", { lineHeight: "1.3", letterSpacing: "-0.01em", fontWeight: "600" }],
        "body-lg": ["18px", { lineHeight: "1.6", fontWeight: "400" }],
        "body-md": ["16px", { lineHeight: "1.6", fontWeight: "400" }],
        "body-sm": ["14px", { lineHeight: "1.5", fontWeight: "400" }],
        "label": ["13px", { lineHeight: "1.4", fontWeight: "500" }],
        "label-caps": ["12px", { lineHeight: "1", letterSpacing: "0.08em", fontWeight: "500" }],
        "code": ["13.5px", { lineHeight: "1.6", fontWeight: "400" }],
      },
      borderRadius: {
        sm: "6px",
        DEFAULT: "8px",
        md: "8px",
        lg: "10px",
        xl: "12px",
        "2xl": "16px",
        "3xl": "20px",
      },
      spacing: {
        container: "1200px",
        gutter: "24px",
      },
      backgroundImage: {
        "grid-pattern":
          "linear-gradient(hsl(var(--border)) 1px, transparent 1px), linear-gradient(90deg, hsl(var(--border)) 1px, transparent 1px)",
      },
      boxShadow: {
        elevated: "0 1px 2px hsl(var(--shadow) / 0.06), 0 12px 32px -16px hsl(var(--shadow) / 0.24)",
        card: "0 1px 2px hsl(var(--shadow) / 0.04), 0 4px 16px -12px hsl(var(--shadow) / 0.16)",
      },
      animation: {
        "fade-in": "fadeIn 0.5s ease-out forwards",
        "fade-up": "fadeUp 0.6s cubic-bezier(0.16,1,0.3,1) forwards",
        shimmer: "shimmer 2s linear infinite",
      },
      keyframes: {
        fadeIn: { "0%": { opacity: "0" }, "100%": { opacity: "1" } },
        fadeUp: {
          "0%": { opacity: "0", transform: "translateY(12px)" },
          "100%": { opacity: "1", transform: "translateY(0)" },
        },
        shimmer: {
          "0%": { backgroundPosition: "-200% 0" },
          "100%": { backgroundPosition: "200% 0" },
        },
      },
      transitionTimingFunction: {
        "out-expo": "cubic-bezier(0.16, 1, 0.3, 1)",
      },
    },
  },
  plugins: [require("tailwindcss-animate")],
};

export default config;
