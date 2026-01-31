import type { Config } from 'tailwindcss';

const config: Config = {
  content: ['./pages/**/*.{js,ts,jsx,tsx}', './components/**/*.{js,ts,jsx,tsx}', './layouts/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        brand: {
          primary: '#0F766E',
          secondary: '#0B1F35',
          accent: '#F59E0B',
        },
      },
      boxShadow: {
        card: '0 18px 45px -18px rgba(11, 31, 53, 0.35)',
      },
    },
  },
  plugins: [],
};

export default config;
