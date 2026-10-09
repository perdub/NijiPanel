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
        // IBM Carbon Dark Palette
        carbon: {
          950: '#0d0e12', // Deepest background
          900: '#14161d', // Primary panel / container background
          850: '#1a1d26', // Elevated card / surface background
          800: '#222633', // Hover / row background
          700: '#2b303c', // Carbon crisp border (1px solid #2b303c)
          600: '#383f4f', // Subtle divider
          500: '#5a6478', // Muted text / icons
          400: '#8c96a8', // Secondary text
          300: '#b4bccb',
          200: '#dce0e8',
          100: '#f2f4f8',
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
          stage: '#0d0e12',
          card: '#1a1d26',
          border: '#2b303c',
        },
        // Backward-compatible deck palette updated to Carbon + Dorito
        deck: {
          950: '#0d0e12',
          900: '#14161d',
          850: '#1a1d26',
          800: '#222633',
          700: '#2b303c',
          600: '#383f4f',
          500: '#5a6478',
          accent: '#ffd100',
          'accent-hover': '#f59e0b',
          success: '#10b981',
          warning: '#f59e0b',
          danger: '#f43f5e',
        }
      },
      fontFamily: {
        mono: ['JetBrains Mono', 'ui-monospace', 'SFMono-Regular', 'Menlo', 'Monaco', 'Consolas', 'monospace'],
        sans: ['Inter', 'system-ui', '-apple-system', 'BlinkMacSystemFont', 'Segoe UI', 'Roboto', 'sans-serif'],
      }
    },
  },
  plugins: [],
}
