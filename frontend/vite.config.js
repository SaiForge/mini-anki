import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: {
    host: true, // Needed for Docker to map the port correctly
    port: 5173,
    watch: {
      usePolling: true // Ensures hot-reloading works inside the container
    }
  }
})
