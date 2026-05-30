/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  theme: {
    extend: {
      colors: {
        nasa: {
          blue: "#2B7DE9",
          "blue-light": "#5A9CF0",
          "blue-darker": "#0B3D91",
          "blue-dark": "#061F4A",
          red: "#FC3D21",
          white: "#FFFFFF",
          gray: {
            50: "#F7F8FA",
            100: "#E8ECF1",
            200: "#D0D7E0",
            300: "#B0BACA",
            400: "#8B97AB",
            500: "#6B7A8F",
            600: "#516175",
            700: "#3D4F65",
            800: "#2E3F54",
            900: "#1F2F42",
            950: "#182536",
          },
        },
      },
      fontFamily: {
        heading: ["Inter", "system-ui", "sans-serif"],
        body: ["Public Sans", "system-ui", "sans-serif"],
        mono: ["DM Mono", "monospace"],
      },
      boxShadow: {
        card: "0 1px 3px 0 rgba(0, 0, 0, 0.2), 0 1px 2px -1px rgba(0, 0, 0, 0.15)",
        "card-lg":
          "0 4px 6px -1px rgba(0, 0, 0, 0.2), 0 2px 4px -2px rgba(0, 0, 0, 0.15)",
      },
    },
  },
  plugins: [],
};
