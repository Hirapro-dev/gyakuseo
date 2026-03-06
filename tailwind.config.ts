import type { Config } from "tailwindcss";

const config: Config = {
  darkMode: "class",
  content: [
    "./pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        navy: {
          50: "#f0f3ff",
          100: "#dbe1ff",
          200: "#b6c3ff",
          300: "#8199ff",
          400: "#4d6fff",
          500: "#2a4ecb",
          600: "#1e3a9e",
          700: "#162d7a",
          800: "#0f1d45",
          900: "#0a1333",
          950: "#060d1f",
        },
        accent: {
          50: "#fffbeb",
          100: "#fff3c4",
          200: "#fce588",
          300: "#fadb5f",
          400: "#f7c948",
          500: "#f0b429",
          600: "#de911d",
          700: "#cb6e17",
          800: "#b44d12",
          900: "#8d2b0b",
        },
      },
      fontFamily: {
        sans: ["system-ui", "sans-serif"],
      },
    },
  },
  plugins: [],
};

export default config;
