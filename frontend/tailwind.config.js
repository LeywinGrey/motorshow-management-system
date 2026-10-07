/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        brand: {
          50: '#fbf3f3',
          100: '#f5e0e0',
          200: '#ebc3c4',
          500: '#b4393f',
          600: '#9c2f35',
          700: '#7f262b',
          800: '#661f23',
        },
      },
    },
  },
  plugins: [],
};
