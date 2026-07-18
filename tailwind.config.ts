import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        // Flat dark palette — minimal, high-contrast, single accent.
        bg: "#0a0b0d",
        panel: "#101215",
        panel2: "#161a1f",
        panelborder: "#23272e",
        gold: "#e8b54a",
        accent: "#5fd0c5", // cool cyan accent (Naowh-ish)
        tier: {
          bronze: "#c08457",
          silver: "#b7c0cc",
          gold: "#e8b54a",
          plat: "#5fd0c5",
          diamond: "#79a8ff",
          legend: "#e08cff",
        },
      },
      fontFamily: {
        sans: ["var(--font-overpass)", "system-ui", "sans-serif"],
        display: ["var(--font-overpass)", "system-ui", "sans-serif"],
      },
      boxShadow: {
        card: "0 1px 0 rgba(255,255,255,0.02) inset",
      },
    },
  },
  plugins: [],
};

export default config;
