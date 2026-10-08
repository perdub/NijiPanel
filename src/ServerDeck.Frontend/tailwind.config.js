/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        deck: {
          950: '#0a0d14',
          900: '#0f1422',
          850: '#141b2d',
          800: '#1a233a',
          700: '#263352',
          600: '#394b73',
          500: '#4d6599',
          accent: '#3b82f6',
          success: '#10b981',
          warning: '#f59e0b',
          danger: '#ef4444',
        }
      }
    },
  },
  plugins: [],
}
