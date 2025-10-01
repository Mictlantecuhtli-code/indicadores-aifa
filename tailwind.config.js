/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx,ts,tsx}'],
  theme: {
    extend: {
      colors: {
        'aifa-blue': '#1E3A8A',
        'aifa-light': '#3B82F6',
        'aifa-green': '#047857',
        'aifa-amber': '#F59E0B'
      },
      fontFamily: {
        sans: ['"Nunito"', '"Inter"', 'system-ui', '-apple-system', 'BlinkMacSystemFont', '"Segoe UI"', 'sans-serif']
      }
    }
  },
  plugins: []
};
