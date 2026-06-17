// Configuration Vite de la démo API (React + TypeScript, calquée sur dyper-web). Le proxy renvoie
// « /api » et « /health » vers la passerelle dyper-api (port 3000) : les requêtes partent donc de la
// MÊME origine que la démo (port 5174), ce qui évite tout problème de CORS (cookie de session et
// en-tête X-App-Key transmis tels quels).
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5174,
    strictPort: true,
    proxy: {
      '^/api/': { target: 'http://localhost:3000', changeOrigin: true },
      '/health': { target: 'http://localhost:3000', changeOrigin: true },
    },
  },
})
