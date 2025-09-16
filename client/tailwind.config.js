/** @type {import('tailwindcss').Config} */
module.exports = {
  darkMode: 'class', // по желанию
  content: [
    './app/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
    './pages/**/*.{js,ts,jsx,tsx,mdx}', // если вдруг используется
    './hooks/**/*.{js,ts,jsx,tsx}',
    './lib/**/*.{js,ts,jsx,tsx}',
    './**/*.{ts,tsx}', // на всякий случай
  ],
  theme: {
    container: { center: true, padding: '1rem' }, // мобильный контейнер
    extend: {
      // мелкие улучшения UX на мобилке
      borderRadius: { 'xl': '0.75rem', '2xl': '1rem' },
      spacing: { 'safe-b': 'env(safe-area-inset-bottom)' }, // для вырезов
    },
  },
  plugins: [
    // удобные плагины (по желанию):
    // require('@tailwindcss/forms'),
    // require('@tailwindcss/typography'),
    // require('@tailwindcss/line-clamp'),
  ],
};
