import process from 'node:process'
import { fileURLToPath } from 'node:url'
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(),tailwindcss()],
  server: { fs: {deny:['.env','.env.*','*.{crt,pem}','**/.git/**','**/.pdv-local/**','**/*.sql']}, host: '0.0.0.0', proxy: { '/api': process.env.PDV_API_TARGET || 'http://127.0.0.1:3000' } },
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
    },
  },
})
