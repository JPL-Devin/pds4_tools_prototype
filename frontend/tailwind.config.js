/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  theme: {
    extend: {
      colors: {
        nasa: {
          blue: "#1E6FD9",
          "blue-light": "#4A90E2",
          "blue-darker": "#0B3D91",
          "blue-dark": "#061F4A",
          red: "#FC3D21",
          white: "#FFFFFF",
          gray: {
            50: "#F7F8FA",
            100: "#E8EBF0",
            200: "#C9CFD9",
            300: "#A3ADBF",
            400: "#7E8BA0",
            500: "#5F6B80",
            600: "#434E60",
            700: "#2D3748",
            800: "#1E2738",
            900: "#131C2A",
            950: "#0D1420",
          },
        },
      },
      fontFamily: {
        heading: ["Inter", "system-ui", "sans-serif"],
        body: ["Public Sans", "system-ui", "sans-serif"],
        mono: ["DM Mono", "monospace"],
      },
      boxShadow: {
        card: "0 1px 3px 0 rgba(0, 0, 0, 0.3), 0 1px 2px -1px rgba(0, 0, 0, 0.3)",
        "card-lg":
          "0 4px 6px -1px rgba(0, 0, 0, 0.3), 0 2px 4px -2px rgba(0, 0, 0, 0.3)",
      },
    },
  },
  plugins: [],
};
