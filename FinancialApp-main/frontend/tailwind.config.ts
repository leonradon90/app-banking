import type { Config } from 'tailwindcss';

const config: Config = {
  content: ['./pages/**/*.{js,ts,jsx,tsx}', './components/**/*.{js,ts,jsx,tsx}', './layouts/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        brand: {
          primary: '#1B5CFE',
          secondary: '#121C2D',
          accent: '#00D2A0',
        },
      },
      boxShadow: {
        card: '0 18px 40px -12px rgba(27, 92, 254, 0.25)',
      },
    },
  },
  plugins: [],
};

export default config;
