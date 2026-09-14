import type { Config } from "tailwindcss";

// Axiom design tokens — "mission control for a living company."
// Calm, precise, analytical. Depth via layered surfaces + hairlines + type,
// never drop-shadow soup. Color communicates meaning, not decoration.
const config: Config = {
  darkMode: "class",
  content: ["./app/**/*.{js,ts,jsx,tsx,mdx}", "./lib/**/*.{js,ts,jsx,tsx,mdx}", "./components/**/*.{js,ts,jsx,tsx,mdx}"],
  theme: {
    extend: {
      fontFamily: {
        display: ["var(--font-display)", "ui-sans-serif", "system-ui", "sans-serif"],
        body: ["var(--font-body)", "ui-sans-serif", "system-ui", "sans-serif"],
        num: ["var(--font-num)", "ui-monospace", "SFMono-Regular", "monospace"],
      },
      colors: {
        // Layered surfaces (depth without shadow)
        base: "#0B0E13",
        surface: {
          0: "#0B0E13",
          1: "#111620",
          2: "#161C29",
          3: "#1C2432",
        },
        hairline: "#262E3C",
        ink: {
          primary: "#E7EAF0",
          secondary: "#9AA5B4",
          faint: "#5C6675",
        },
        // Semantic system — one meaning per token, used nowhere else
        trajectory: {
          positive: "#3FCDB4", // moving toward goal
          negative: "#E8735C", // moving away from goal
        },
        signal: {
          warning: "#E0A94B", // needs attention, not yet critical
          risk: "#E0524B", // active threat to goal/runway
          action: "#6C86F0", // Axiom is acting / recommends acting
          approval: "#B08BF0", // requires human authority
          uncertainty: "#8890A0", // low confidence / unverified
          verified: "#4FB8D6", // confirmed by Verifier agent
          inferred: "#9C8FBF", // derived, not directly observed
        },
      },
      fontSize: {
        // Restrained type scale (Elements of Typographic Style ratios)
        "display-xl": ["3.052rem", { lineHeight: "1.05", letterSpacing: "-0.01em" }],
        "display-lg": ["2.441rem", { lineHeight: "1.08", letterSpacing: "-0.01em" }],
        "display-md": ["1.953rem", { lineHeight: "1.15", letterSpacing: "-0.005em" }],
        "display-sm": ["1.563rem", { lineHeight: "1.2" }],
        "body-lg": ["1.125rem", { lineHeight: "1.6" }],
        body: ["0.9375rem", { lineHeight: "1.6" }],
        "body-sm": ["0.8125rem", { lineHeight: "1.5" }],
        micro: ["0.6875rem", { lineHeight: "1.4", letterSpacing: "0.02em" }],
      },
      borderRadius: {
        none: "0px",
        sm: "3px",
        DEFAULT: "5px",
        md: "6px",
        lg: "8px",
      },
      transitionTimingFunction: {
        axiom: "cubic-bezier(0.2, 0.7, 0.2, 1)",
      },
      keyframes: {
        "trace-in": {
          "0%": { opacity: "0", transform: "translateX(-4px)" },
          "100%": { opacity: "1", transform: "translateX(0)" },
        },
        pulse2: {
          "0%, 100%": { opacity: "0.55" },
          "50%": { opacity: "1" },
        },
      },
      animation: {
        "trace-in": "trace-in 0.35s cubic-bezier(0.2,0.7,0.2,1) both",
        "agent-pulse": "pulse2 1.8s ease-in-out infinite",
      },
    },
  },
  plugins: [],
};

export default config;
