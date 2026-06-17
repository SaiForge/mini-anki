import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    host: true, // Needed for Docker to map the port correctly
    port: 5173,
    watch: {
      usePolling: true // Ensures hot-reloading works inside the container
    }
  },
  resolve: {
    alias: {
      '@': '/src'
    }
  }
})
