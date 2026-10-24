import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  base: './',
  plugins: [react()],
  server: {
    port: 5180,
    strictPort: true,
    open: false,
  },
  build: {
    target: 'es2020',
    chunkSizeWarningLimit: 900,
  },
})
