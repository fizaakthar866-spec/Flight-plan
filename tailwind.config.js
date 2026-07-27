/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ["./app/**/*.{js,ts,jsx,tsx}", "./components/**/*.{js,ts,jsx,tsx}"],
  theme: {
    extend: {
      colors: {
        base: "#0b0e14",
        panel: "#131722",
        accent: "#3ba7ff",
      },
    },
  },
  plugins: [],
};
