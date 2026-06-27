/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./app/**/*.{js,jsx,ts,tsx}",
    "./components/**/*.{js,jsx,ts,tsx}",
  ],
  darkMode: "class",
  theme: {
    extend: {
      colors: {
        primary: {
          DEFAULT: "#25D366",
          hover: "#1ebe5d",
          dark: "#128C7E",
        },
        dark: {
          bg: "#0a0a0a",
          surface: "#111111",
          border: "#1f1f1f",
        },
        light: {
          bg: "#ffffff",
          surface: "#f0fdf4",
          border: "#d1fae5",
        },
      },
      fontFamily: {
        sans: ["Inter", "sans-serif"],
      },
    },
  },
  plugins: [],
};
