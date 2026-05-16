import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./src/app/**/*.{ts,tsx}",
    "./src/components/**/*.{ts,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        // Canvas + surfaces
        bg: "var(--bg)",
        surface: "var(--surface)",
        "surface-2": "var(--surface-2)",
        "surface-sunken": "var(--surface-sunken)",

        // Text scale
        text: "var(--text)",
        "text-2": "var(--text-2)",
        "text-3": "var(--text-3)",
        "text-mute": "var(--text-mute)",

        // Borders
        border: "var(--border)",
        "border-strong": "var(--border-strong)",

        // Brand / state colors
        primary: "var(--primary)",
        "primary-hover": "var(--primary-hover)",
        "primary-soft": "var(--primary-soft)",
        "primary-ink": "var(--primary-ink)",

        success: "var(--success)",

        warning: "var(--warning)",
        "warning-soft": "var(--warning-soft)",

        error: "var(--error)",
        "error-soft": "var(--error-soft)",

        info: "var(--info)",
        "info-soft": "var(--info-soft)",

        gold: "var(--gold)",
      },
      fontFamily: {
        sans: ["var(--font-sans)"],
        mono: ["var(--font-mono)"],
      },
      borderRadius: {
        sm: "var(--r-sm)",
        md: "var(--r-md)",
        lg: "var(--r-lg)",
        xl: "var(--r-xl)",
        full: "var(--r-full)",
      },
      spacing: {
        "s-1": "var(--s-1)",
        "s-2": "var(--s-2)",
        "s-3": "var(--s-3)",
        "s-4": "var(--s-4)",
        "s-5": "var(--s-5)",
        "s-6": "var(--s-6)",
        "s-8": "var(--s-8)",
        "s-10": "var(--s-10)",
        "s-12": "var(--s-12)",
        "s-16": "var(--s-16)",
      },
      boxShadow: {
        card: "var(--shadow-card)",
        pop: "var(--shadow-pop)",
        "focus-ring": "0 0 0 3px var(--primary-soft)",
      },
    },
  },
  plugins: [],
};

export default config;
