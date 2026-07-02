import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    // Score API runs alongside the dev server (see server/index.js)
    proxy: { '/api': 'http://localhost:5174' },
  },
  preview: {
    port: 4173,
    proxy: { '/api': 'http://localhost:5174' },
  },
})
