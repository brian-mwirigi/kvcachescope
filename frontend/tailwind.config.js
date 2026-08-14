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
        dark: {
          950: '#090d16',
          900: '#0d1322',
          850: '#11182c',
          800: '#172038',
          700: '#233054',
          600: '#344574'
        },
        brand: {
          cyan: '#00f2fe',
          blue: '#4facfe',
          purple: '#8a2be2',
          rose: '#ff0844',
          amber: '#f6d365',
          emerald: '#10b981'
        }
      },
      fontFamily: {
        mono: ['Fira Code', 'JetBrains Mono', 'Menlo', 'monospace']
      },
      animation: {
        'pulse-slow': 'pulse 3s cubic-bezier(0.4, 0, 0.6, 1) infinite',
        'glow': 'glow 2s ease-in-out infinite alternate',
      },
      keyframes: {
        glow: {
          '0%': { boxShadow: '0 0 5px rgba(0, 242, 254, 0.4)' },
          '100%': { boxShadow: '0 0 15px rgba(0, 242, 254, 0.8)' }
        }
      }
    },
  },
  plugins: [],
}
