import type { Config } from "tailwindcss";

/**
 * PhysioDesk Design System — strict tokens.
 * Do not introduce ad-hoc colors; extend this palette instead.
 */
const config: Config = {
  content: [
    "./src/app/**/*.{ts,tsx,mdx}",
    "./src/components/**/*.{ts,tsx}",
    "./src/lib/**/*.{ts,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        primary: "#B8763A",
        "primary-text-soft": "#5C3A17",
        "primary-soft": "#F0DFC7",

        secondary: "#132420",
        "secondary-light": "#1D362F",

        tertiary: "#4F7C63",
        "tertiary-soft": "#E1EBE3",

        "bg-app": "#F6F3EA",
        surface: "#FFFFFF",
        "border-custom": "#E4DFD1",

        "text-primary": "#1C2622",
        "text-secondary": "#797365",

        "status-success": "#4F7C63",
        "status-success-soft": "#E1EBE3",
        "status-error": "#B5493B",
        "status-error-soft": "#F3DEDA",
        "status-neutral": "#5E6B78",
        "status-neutral-soft": "#E7EBEE",
      },
      fontFamily: {
        display: ["var(--font-fraunces)", "serif"],
        body: ["var(--font-inter)", "sans-serif"],
        mono: ["var(--font-ibm-plex-mono)", "monospace"],
      },
      boxShadow: {
        // Soft, warm drop shadow for cards/panels.
        soft: "0 1px 3px rgba(28, 38, 34, 0.06), 0 4px 14px rgba(28, 38, 34, 0.05)",
        "soft-lg": "0 4px 24px rgba(28, 38, 28, 0.10)",
      },
      borderRadius: {
        // ~14px card radius per design spec.
        card: "14px",
      },
    },
  },
  plugins: [],
};

export default config;
