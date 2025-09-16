/** @type {import('tailwindcss').Config} */
/* eslint-disable @typescript-eslint/no-require-imports */
module.exports = {
  content: [
    './src/**/*.{js,ts,jsx,tsx,mdx}',
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    // Удобный контейнер "из коробки"
    container: {
      center: true,
      padding: {
        DEFAULT: '1rem',   // мобилка
        sm: '1.25rem',
        md: '1.5rem',
        lg: '2rem',
        xl: '2.5rem',
        '2xl': '3rem',
      },
    },
    extend: {
      // Можешь настроить цвет темы здесь, если используешь meta theme-color
      colors: {
        brand: {
          DEFAULT: '#2563eb',
          dark: '#1e3a8a',
        },
      },
      // Гладкие тени и скругления, приятные на телефоне
      borderRadius: {
        'xl': '1rem',
        '2xl': '1.25rem',
      },
      boxShadow: {
        soft: '0 8px 20px rgba(0,0,0,0.12)',
      },
      // Оптимальные точки перелома можно оставить дефолтные; добавлю sm-only
      screens: {
        'xs': '380px',
      },
    },
  },
  // Полезные плагины: формы (нормализует инпуты), типографика (prose), лайн-кламп
  plugins: [
    require('@tailwindcss/forms'),
    require('@tailwindcss/typography'),
    require('@tailwindcss/line-clamp'),
  ],
  // Вдруг генерируешь классы динамически — подсейвим пару часто нужных
  safelist: [
    'snap-x', 'snap-mandatory', 'snap-start',
    'prose', 'prose-sm', 'line-clamp-2', 'line-clamp-3',
  ],
};
