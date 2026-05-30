import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      fontSize: {
        "2xs": ["0.68rem", { lineHeight: "0.9rem" }],
        "3xs": ["0.58rem", { lineHeight: "0.75rem" }],
      },
      colors: {
        background: "var(--background)",
        foreground: "var(--foreground)",
        neutral: {
          750: "#222222",
          850: "#181818",
        },
        indigo: {
          550: "#5a5cf6",
        },
      },
    },
  },
  plugins: [],
};
export default config;
