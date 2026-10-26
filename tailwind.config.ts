import type { Config } from 'tailwindcss';

const config: Config = {
  content: ['./app/**/*.{ts,tsx}', './components/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        ground: 'var(--ground)',
        surface: 'var(--surface)',
        inset: 'var(--inset)',
        ink: 'var(--ink)',
        'ink-2': 'var(--ink-2)',
        hairline: 'var(--hairline)',
        brand: 'var(--brand)',
        'brand-soft': 'var(--brand-soft)',
        red: 'var(--red)',
        'red-soft': 'var(--red-soft)',
        'red-line': 'var(--red-line)',
        amber: 'var(--amber)',
        'amber-soft': 'var(--amber-soft)',
        'amber-line': 'var(--amber-line)',
        green: 'var(--green)',
        'green-soft': 'var(--green-soft)',
        'green-line': 'var(--green-line)',
      },
      borderRadius: { card: '16px', chip: '10px' },
      boxShadow: {
        card: '0 1px 2px rgba(15,17,22,.05), 0 12px 32px -20px rgba(15,17,22,.35)',
      },
    },
  },
  plugins: [],
};

export default config;
