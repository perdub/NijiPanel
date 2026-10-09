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
        // IBM Carbon True Pitch Black Palette (OLED & Pure Neutral Dark)
        carbon: {
          950: '#000000', // Pure pitch black (OLED base)
          900: '#080808', // Primary panel / container background
          850: '#111111', // Elevated card / surface background
          800: '#181818', // Hover / row background
          750: '#222222', // Subtle borders
          700: '#282828', // Carbon crisp border (1px solid #282828)
          600: '#383838', // Subtle divider
          500: '#666666', // Muted text / icons
          400: '#999999', // Secondary text
          300: '#cccccc',
          200: '#e5e5e5',
          100: '#f5f5f5',
        },
        // Nijika's Dorito Yellow & Warm Amber Palette
        dorito: {
          50: '#fffbeb',
          100: '#fef3c7',
          200: '#fde68a',
          300: '#fcd34d',
          400: '#fbbf24',
          500: '#ffd100', // Signature Dorito Yellow (Nijika hair & ahoge)
          600: '#f59e0b', // Warm Amber (accent / hover)
          700: '#d97706',
          800: '#b45309',
          orange: '#ea580c', // Dorito spicy orange
        },
        // Nijika / Kessoku Band Character Colors
        niji: {
          dorito: '#ffd100',
          amber: '#f59e0b',
          orange: '#ea580c',
          ribbon: '#f43f5e', // Nijika's iconic hair ribbon
          ribbonDark: '#be123c',
          drum: '#e0a96d',
          stage: '#000000',
          card: '#111111',
          border: '#282828',
        },
        // Backward-compatible deck palette updated to true black + Dorito
        deck: {
          950: '#000000',
          900: '#080808',
          850: '#111111',
          800: '#181818',
          700: '#282828',
          600: '#383838',
          500: '#666666',
          accent: '#ffd100',
          'accent-hover': '#f59e0b',
          success: '#10b981',
          warning: '#f59e0b',
          danger: '#f43f5e',
        }
      },
      fontFamily: {
        mono: ['JetBrains Mono', 'ui-monospace', 'SFMono-Regular', 'Menlo', 'Monaco', 'Consolas', 'monospace'],
        sans: ['Inter', '-apple-system', 'BlinkMacSystemFont', 'Segoe UI', 'Roboto', 'sans-serif'],
      }
    },
  },
  plugins: [],
}
