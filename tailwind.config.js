/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        void: '#04060A',
        umbra: '#080C12',
        kapton: '#F5B041',
        lband: '#00F0FF',
        sband: '#FF2A85',
        lens: '#F4FBFF',
        slate: '#7C8D9E',
      },
      fontFamily: {
        sans: ['"Inter Variable"', 'Inter', 'system-ui', '-apple-system', 'Helvetica Neue', 'Arial', 'sans-serif'],
        mono: ['"JetBrains Mono Variable"', '"JetBrains Mono"', 'ui-monospace', 'SF Mono', 'Menlo', 'Consolas', 'monospace'],
        serif: ['"Instrument Serif"', 'Iowan Old Style', 'Palatino Linotype', 'Georgia', 'serif'],
      },
      letterSpacing: {
        monument: '0.34em',
        tele: '0.14em',
      },
      borderRadius: {
        lens: '24px',
        panel: '28px',
      },
      screens: {
        xs: '420px',
      },
    },
  },
  plugins: [],
};
