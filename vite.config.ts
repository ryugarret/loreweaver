import { defineConfig } from 'vite'
import { fileURLToPath, URL } from 'node:url'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { VitePWA } from 'vite-plugin-pwa'

// Ruta base: '/' en local (dev, build portable, preview). En GitHub Pages la app
// vive en un subdirectorio (usuario.github.io/REPO/), así que el flujo de Actions
// pasa VITE_BASE = base_path del sitio y aquí lo normalizamos con barras.
const rawBase = process.env.VITE_BASE || '/'
const base = rawBase === '/' || rawBase === '' ? '/' : rawBase.replace(/\/?$/, '/')

// https://vite.dev/config/
export default defineConfig({
  base,
  plugins: [
    react(),
    tailwindcss(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.ico', 'favicon.svg', 'apple-touch-icon-180x180.png'],
      manifest: {
        name: 'Loreweaver — Estudio de escritura',
        short_name: 'Loreweaver',
        description:
          'Tu estudio de escritura y worldbuilding: capítulos, wiki, línea de tiempo y tablero. 100% local y offline.',
        lang: 'es',
        theme_color: '#8b5cf6',
        background_color: '#131119',
        display: 'standalone',
        start_url: '.',
        icons: [
          { src: 'pwa-64x64.png', sizes: '64x64', type: 'image/png' },
          { src: 'pwa-192x192.png', sizes: '192x192', type: 'image/png' },
          { src: 'pwa-512x512.png', sizes: '512x512', type: 'image/png' },
          {
            src: 'maskable-icon-512x512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'maskable',
          },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,svg,png,ico,woff2}'],
        maximumFileSizeToCacheInBytes: 4 * 1024 * 1024,
      },
      devOptions: { enabled: true, type: 'module' },
    }),
  ],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
})
