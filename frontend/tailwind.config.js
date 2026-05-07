/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  theme: {
    extend: {
      colors: {
        nasa: {
          blue: "#105BD8",
          "blue-darker": "#0B3D91",
          "blue-dark": "#061F4A",
          red: "#FC3D21",
          white: "#FFFFFF",
          gray: {
            50: "#F5F5F5",
            100: "#E0E0E0",
            200: "#BDBDBD",
            300: "#9E9E9E",
            400: "#757575",
            500: "#616161",
            600: "#424242",
            700: "#303030",
            800: "#212121",
            900: "#121212",
          },
        },
      },
      fontFamily: {
        heading: ["Inter", "system-ui", "sans-serif"],
        body: ["Public Sans", "system-ui", "sans-serif"],
        mono: ["DM Mono", "monospace"],
      },
    },
  },
  plugins: [],
};
