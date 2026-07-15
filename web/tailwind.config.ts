import type { Config } from "tailwindcss";

const config: Config = {
  darkMode: "class",
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      fontFamily: {
        sans: [
          "var(--font-inter)",
          "SF Pro Display",
          "SF Pro Text",
          "-apple-system",
          "BlinkMacSystemFont",
          "Helvetica Neue",
          "sans-serif",
        ],
        mono: ["SF Mono", "JetBrains Mono", "Menlo", "monospace"],
      },
      fontSize: {
        "large-title": ["2.125rem", { lineHeight: "2.5rem", letterSpacing: "-0.025em", fontWeight: "700" }],
        "title-1": ["1.75rem", { lineHeight: "2.125rem", letterSpacing: "-0.02em", fontWeight: "700" }],
        "title-2": ["1.375rem", { lineHeight: "1.75rem", letterSpacing: "-0.01em", fontWeight: "700" }],
        "title-3": ["1.25rem", { lineHeight: "1.625rem", letterSpacing: "-0.005em", fontWeight: "600" }],
        headline: ["1.0625rem", { lineHeight: "1.375rem", fontWeight: "600" }],
        body: ["1.0625rem", { lineHeight: "1.5625rem", fontWeight: "400" }],
        callout: ["1rem", { lineHeight: "1.375rem", fontWeight: "400" }],
        subheadline: ["0.9375rem", { lineHeight: "1.25rem", fontWeight: "400" }],
        footnote: ["0.8125rem", { lineHeight: "1.125rem", fontWeight: "400" }],
        "caption-1": ["0.75rem", { lineHeight: "1rem", letterSpacing: "0.006em" }],
        "caption-2": ["0.6875rem", { lineHeight: "0.875rem", letterSpacing: "0.006em" }],
      },
      colors: {
        bg: {
          primary: "var(--color-bg-primary)",
          secondary: "var(--color-bg-secondary)",
          tertiary: "var(--color-bg-tertiary)",
          elevated: "var(--color-bg-elevated)",
        },
        separator: "var(--color-separator)",
        fill: {
          quaternary: "var(--color-fill-quaternary)",
        },
        text: {
          primary: "var(--color-text-primary)",
          secondary: "var(--color-text-secondary)",
          tertiary: "var(--color-text-tertiary)",
          quaternary: "var(--color-text-quaternary)",
          "on-accent": "var(--color-text-on-accent)",
        },
        brand: "var(--color-brand)",
        activity: "var(--color-activity)",
        heart: "var(--color-heart)",
        mindfulness: "var(--color-mindfulness)",
        nutrition: "var(--color-nutrition)",
        sleep: "var(--color-sleep)",
        medications: "var(--color-medications)",
        body: "var(--color-body)",
        labs: "var(--color-labs)",
        reproductive: "var(--color-reproductive)",
        hearing: "var(--color-hearing)",
        status: {
          normal: "var(--color-status-normal)",
          high: "var(--color-status-high)",
          low: "var(--color-status-low)",
          borderline: "var(--color-status-borderline)",
          critical: "var(--color-status-critical)",
        },
      },
      borderRadius: {
        card: "var(--radius-card)",
        inner: "var(--radius-inner)",
        chip: "var(--radius-chip)",
      },
      boxShadow: {
        card: "var(--shadow-card)",
        "card-hover": "var(--shadow-card-hover)",
        modal: "var(--shadow-modal)",
      },
      spacing: {
        "4.5": "1.125rem",
        "18": "4.5rem",
        "22": "5.5rem",
      },
      transitionTimingFunction: {
        "spring-enter": "cubic-bezier(0.34, 1.56, 0.64, 1)",
        "spring-exit": "cubic-bezier(0.55, 0, 1, 0.45)",
        ios: "cubic-bezier(0.25, 0.46, 0.45, 0.94)",
      },
      transitionDuration: {
        "250": "250ms",
        "280": "280ms",
        "320": "320ms",
        "350": "350ms",
        "900": "900ms",
      },
      keyframes: {
        "fade-up": {
          "0%": { opacity: "0", transform: "translateY(12px)" },
          "100%": { opacity: "1", transform: "translateY(0)" },
        },
        "fade-in": {
          "0%": { opacity: "0" },
          "100%": { opacity: "1" },
        },
        "scale-in": {
          "0%": { opacity: "0", transform: "scale(0.97) translateY(8px)" },
          "100%": { opacity: "1", transform: "scale(1) translateY(0)" },
        },
        "slide-right": {
          "0%": { transform: "translateX(16px)", opacity: "0" },
          "100%": { transform: "translateX(0)", opacity: "1" },
        },
      },
      animation: {
        "fade-up": "fade-up 280ms cubic-bezier(0.34, 1.56, 0.64, 1) both",
        "fade-in": "fade-in 200ms ease-out both",
        "scale-in": "scale-in 300ms cubic-bezier(0.34, 1.56, 0.64, 1) both",
        "slide-right": "slide-right 250ms cubic-bezier(0.34, 1.56, 0.64, 1) both",
      },
    },
  },
  plugins: [],
};

export default config;
