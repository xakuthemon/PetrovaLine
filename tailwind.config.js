/** @type {import('tailwindcss').Config} */
// Petrova Line palette, taken from the logo: ink ground, cream discs, crimson line.
const ink = '#171824', night = '#0F1019', cream = '#F4ECE3', crimson = '#D3243F', fog = '#9C9797', steel = '#7E9BD0';

export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        ink, night, cream, crimson, fog, steel,
        panel: '#1D1F2E',
        // the story's navy-and-champagne stage
        gold: '#E4C68F', ice: '#9CCBEB', copper: '#E7A57E',
        // older token names still used by a few console parts
        void: night, umbra: ink, lens: cream, slate: fog, lband: crimson, sband: steel, kapton: crimson,
      },
      fontFamily: {
        sans: ['Archivo', 'system-ui', '-apple-system', '"Segoe UI"', 'Roboto', '"Helvetica Neue"', 'Arial', 'sans-serif'],
        mono: ['"JetBrains Mono"', 'ui-monospace', '"SF Mono"', 'Menlo', 'Consolas', 'monospace'],
      },
      screens: {
        xs: '420px',
      },
    },
  },
  plugins: [
    // short: landscape phones and other low screens
    ({ addVariant }) => { addVariant('short', '@media (max-height: 520px)'); },
    // tall: portrait screens of any width (phones, tablets), matching the 3D stage's portrait framing
    ({ addVariant }) => { addVariant('tall', '@media (max-aspect-ratio: 17/20)'); },
    // wide: landscape-ish screens at least tablet-sized and not short (the desktop slide layout)
    ({ addVariant }) => { addVariant('wide', '@media (min-width: 768px) and (min-aspect-ratio: 17/20) and (min-height: 521px)'); },
  ],
};
