import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./app/**/*.{ts,tsx}", "./lib/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        white: "#ffffff",
        surface: "#fafbfc",
        ink: "#0b0d0f",
        ink2: "#454c54",
        muted: "#79828c",
        blue: "#2a6bf2",
        blueDark: "#1b4bc0",
        blueTint: "#e3edff",
        bluePale: "#f2f6ff",
        rule: "#e6e9ed",
        ruleStrong: "#c9cfd6",
        neg: "#c62828",
      },
      fontFamily: {
        sans: ["var(--font-inter)", '"Helvetica Neue"', "Helvetica", "Arial", "sans-serif"],
      },
      maxWidth: {
        shell: "1240px",
      },
      letterSpacing: {
        eyebrow: "0.14em",
        tight2: "-0.022em",
        tight3: "-0.032em",
      },
      minHeight: { 11: "2.75rem" },
      minWidth: { 11: "2.75rem" },
    },
  },
  plugins: [],
};

export default config;
