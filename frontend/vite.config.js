// frontend/vite.config.js
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { resolve } from 'path'

export default defineConfig({
  root: resolve(__dirname),
  plugins: [react()],
  server: {
    port: 3000,
    proxy: {
      '/api': { 
        target: 'http://127.0.0.1:5000', 
        changeOrigin: true,
        secure: false
      },
      '/manga': { 
        target: 'http://127.0.0.1:5000', 
        changeOrigin: true,
        secure: false
      },
      '/uploads': { 
        target: 'http://127.0.0.1:5000', 
        changeOrigin: true,
        secure: false
      }
    }
  },
  build: {
    outDir: 'dist',
    sourcemap: process.env.NODE_ENV !== 'production', // Only enable source maps in development
    rollupOptions: {
      output: {
        assetFileNames: (assetInfo) => {
          // Force new hash for logo to bust cache
          if (assetInfo.name === 'logo.png') {
            return 'assets/logo-[hash][extname]';
          }
          return 'assets/[name]-[hash][extname]';
        }
      }
    }
  }
})