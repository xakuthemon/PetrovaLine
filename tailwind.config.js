/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        void: '#070B10',
        umbra: '#0C131B',
        kapton: '#E4C68F',
        lband: '#9CCBEB',
        sband: '#E7A57E',
        lens: '#F2EEE6',
        slate: '#8592A0',
      },
      fontFamily: {
        sans: ['"Inter Tight Variable"', '"Inter Tight"', 'Inter', 'system-ui', '-apple-system', 'Helvetica Neue', 'Arial', 'sans-serif'],
        mono: ['"JetBrains Mono Variable"', '"JetBrains Mono"', 'ui-monospace', 'SF Mono', 'Menlo', 'Consolas', 'monospace'],
        
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
