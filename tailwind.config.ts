import type { Config } from 'tailwindcss';

export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        surface: '#1e293b',
        bg: '#0f172a',
      },
    },
  },
  plugins: [],
} satisfies Config;
