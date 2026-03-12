// Configuration Tailwind CSS : analyse les fichiers HTML et TSX pour purger les classes inutilisées.
import type { Config } from 'tailwindcss'

export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {},
  },
  plugins: [],
} satisfies Config
