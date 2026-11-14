/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
        mono: ['JetBrains Mono', 'monospace'],
        serif: ['Cinzel', 'Georgia', 'serif'],
      },
      colors: {
        ordo: {
          bg: '#09090b',
          panel: '#121216',
          border: '#27272a',
          blood: '#dc2626',
          death: '#18181b',
          knowledge: '#eab308',
          energy: '#06b6d4',
          fear: '#f4f4f5'
        }
      }
    },
  },
  plugins: [],
}
