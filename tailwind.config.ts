import type { Config } from "tailwindcss";

const config: Config = {
  darkMode: "class",
  content: ["./src/**/*.{ts,tsx,mdx}"],
  theme: {
    extend: {
      colors: {
        background: "#0A0A0A",
        foreground: "#FFFFFF",
        muted: { DEFAULT: "rgba(255,255,255,0.04)", foreground: "#A1A1AA" },
        border: "rgba(255,255,255,0.08)",
        ring: "#7C3AED",
        surface: {
          DEFAULT: "rgba(255,255,255,0.04)",
          elevated: "rgba(255,255,255,0.06)",
          hover: "rgba(255,255,255,0.08)",
        },
        accent: {
          violet: "#7C3AED",
          cyan: "#06B6D4",
          blue: "#3B82F6",
        },
        primary: { DEFAULT: "#7C3AED", foreground: "#FFFFFF" },
        destructive: { DEFAULT: "#EF4444", foreground: "#FFFFFF" },
        success: { DEFAULT: "#10B981", foreground: "#FFFFFF" },
        warning: { DEFAULT: "#F59E0B", foreground: "#0A0A0A" },
      },
      fontFamily: {
        sans: ["var(--font-inter)", "Inter", "system-ui", "sans-serif"],
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
        sm: "8px",
        DEFAULT: "12px",
        md: "12px",
        lg: "16px",
        xl: "20px",
        "2xl": "24px",
        "3xl": "32px",
      },
      spacing: {
        "container": "1200px",
        "gutter": "24px",
      },
      backgroundImage: {
        "grid-pattern":
          "linear-gradient(rgba(255,255,255,0.04) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.04) 1px, transparent 1px)",
      },
      boxShadow: {
        "elevated":
          "0 1px 0 rgba(255,255,255,0.06) inset, 0 16px 48px -16px rgba(0,0,0,0.6)",
        "card":
          "0 1px 0 rgba(255,255,255,0.04) inset, 0 8px 24px -12px rgba(0,0,0,0.5)",
      },
      animation: {
        "fade-in": "fadeIn 0.6s ease-out forwards",
        "fade-up": "fadeUp 0.7s ease-out forwards",
        "shimmer": "shimmer 2s linear infinite",
      },
      keyframes: {
        fadeIn: { "0%": { opacity: "0" }, "100%": { opacity: "1" } },
        fadeUp: {
          "0%": { opacity: "0", transform: "translateY(16px)" },
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
