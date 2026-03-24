import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      '/api/poketrace': {
        target: 'https://api.poketrace.com',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api\/poketrace/, '/v1'),
        headers: {
          'X-API-Key': 'pc_fb0e8b76efbaf35454be5d403556bed5207cf71ab24312c5'
        }
      }
    }
  }
})