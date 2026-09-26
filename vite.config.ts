import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss()],
  // dev only: listen on the LAN and forward /api to the Node server (npm run dev starts both)
  server: {
    host: true,
    port: 5173,
    strictPort: true, // keep the URL the iPad bookmarked
    proxy: { '/api': `http://localhost:${process.env.PORT ?? 3000}` },
  },
})
