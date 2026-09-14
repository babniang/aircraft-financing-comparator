import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./app/**/*.{ts,tsx}", "./lib/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        bg: "#ffffff",
        ink: "#0d1b2a",
        inkSoft: "#2b3b4d",
        slate: "#52657a",
        blue900: "#0a2540",
        blue700: "#0a4c8b",
        blue500: "#1666c8",
        blue100: "#e6eef8",
        blue050: "#f4f8fc",
        rule: "#c3d0e0",
        ruleStrong: "#9db2cc",
        neg: "#b3261e",
      },
      fontFamily: {
        sans: ['"GS Sans"', '"Helvetica Neue"', "Helvetica", "Arial", "sans-serif"],
        mono: [
          '"SFMono-Regular"',
          "ui-monospace",
          '"SF Mono"',
          "Menlo",
          "Consolas",
          '"Liberation Mono"',
          "monospace",
        ],
      },
      borderRadius: {
        gs: "2px",
      },
      maxWidth: {
        shell: "1180px",
      },
      letterSpacing: {
        eyebrow: "0.11em",
        tight2: "-0.015em",
      },
      minHeight: { 11: "2.75rem" },
      minWidth: { 11: "2.75rem" },
    },
  },
  plugins: [],
};

export default config;
