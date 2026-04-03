/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ["./src/**/*.{js,jsx,ts,tsx}"],
  darkMode: "class",
  theme: {
    extend: {
      fontFamily: {
        landing: ["Inter", "system-ui", "sans-serif"],
      },
      colors: {
        wa: {
          bg: "var(--wa-bg)",
          panel: "var(--wa-panel)",
          header: "var(--wa-header)",
          bar: "var(--wa-bar)",
          bubbleUser: "var(--wa-bubble-user)",
          bubbleBot: "var(--wa-bubble-bot)",
          accent: "var(--wa-accent)",
          muted: "var(--wa-muted)",
        },
        brand: {
          primary: "var(--brand-primary)",
          accent: "var(--brand-accent)",
        },
        emotion: {
          happy: "#22c55e",
          sad: "#3b82f6",
          anxious: "#f97316",
          angry: "#ef4444",
          neutral: "#64748b",
        },
      },
    },
  },
  plugins: [],
};
