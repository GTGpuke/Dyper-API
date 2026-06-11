// Configuration Tailwind CSS — design system « éditorial / clean » de Dyper.
import type { Config } from 'tailwindcss'

export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  // Le thème est piloté par la classe `dark` sur <html> (ThemeContext), pas par prefers-color-scheme.
  darkMode: 'class',
  theme: {
    extend: {
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
        mono: ['"JetBrains Mono"', 'ui-monospace', 'monospace'],
      },
      colors: {
        // Accent principal : « iris », fusion bleu-violet fidèle au branding (les dégradés
        // bleu → violet restent sur les points focaux).
        brand: {
          50: '#f0f1fe',
          100: '#e3e3fd',
          200: '#cccbfb',
          300: '#ada9f7',
          400: '#8f83f1',
          500: '#7463ea',
          600: '#5f49dd',
          700: '#5038c2',
          800: '#42309c',
          900: '#382c7d',
        },
        // Neutres en dégradé de chaleur : le FOND sombre est quasi neutre, et la chaleur
        // n'apparaît que dans les tons éloignés du fond (textes et surfaces claires).
        ink: {
          50: '#f9f8f6',
          100: '#efedea',
          200: '#e2dfd9',
          300: '#cbc7bf',
          400: '#9d988e',
          500: '#76726a',
          600: '#57544f',
          700: '#403e41',
          800: '#2b2a2e',
          900: '#1f1f22',
          950: '#18181a',
        },
      },
      boxShadow: {
        card: '0 1px 2px 0 rgb(24 24 26 / 0.04), 0 1px 3px 0 rgb(24 24 26 / 0.06)',
        'card-hover': '0 10px 30px -12px rgb(24 24 26 / 0.18)',
        focus: '0 0 0 3px rgb(116 99 234 / 0.25)',
      },
      keyframes: {
        'fade-in': {
          '0%': { opacity: '0', transform: 'translateY(6px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        shimmer: {
          '100%': { transform: 'translateX(100%)' },
        },
      },
      animation: {
        'fade-in': 'fade-in 0.4s ease-out both',
        shimmer: 'shimmer 1.6s infinite',
      },
    },
  },
  plugins: [],
} satisfies Config
