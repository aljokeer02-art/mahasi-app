import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        ink: "#12241c",
        forest: {
          50: "#f0f6f2",
          100: "#d9ebe0",
          400: "#3a7a56",
          600: "#1f4d34",
          800: "#153524",
          900: "#0d2116",
        },
        sand: "#f7f5ef",
        gold: "#c9a24b",
      },
      fontFamily: {
        sans: ["var(--font-cairo)", "sans-serif"],
      },
    },
  },
  plugins: [],
};
export default config;
