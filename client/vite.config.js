import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'

export default defineConfig({
  plugins: [vue()],
  server: {
    host: '0.0.0.0',
    port: 20503,
    proxy: {
      '/api': {
        target: 'http://localhost:19503',
        changeOrigin: true
      }
    }
  }
})
