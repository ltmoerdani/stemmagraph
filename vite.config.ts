import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';
import path from 'path';

// GitHub Pages serves the site at /<repo-name>/, so the base must match
// the repo name in production. Locally we keep '/'.
//
// Set BASE_PATH env to override (e.g. for custom domains).
// The GitHub Actions deploy workflow sets this automatically.
const base = process.env.GITHUB_PAGES
  ? process.env.BASE_PATH || '/stemmagraph/'
  : '/';

// https://vite.dev/config/
export default defineConfig({
  base,
  plugins: [
    react(),
    // PWA: offline hanya menyangkut appshell (HTML/JS/CSS/SVG/font).
    // Data API tetap butuh jaringan; service worker tidak meng-cache respons API.
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.svg'],
      manifest: {
        name: 'Stemmagraph',
        short_name: 'Stemmagraph',
        theme_color: '#16a34a',
        background_color: '#ffffff',
        display: 'standalone',
        icons: [
          {
            src: 'favicon.svg',
            sizes: 'any',
            type: 'image/svg+xml',
            purpose: 'any maskable',
          },
        ],
      },
      workbox: {
        navigateFallback: '/index.html',
        // Bundle utama hasil build ±2,7 MB; naikkan limit precache agar appshell utuh.
        maximumFileSizeToCacheInBytes: 3 * 1024 * 1024,
        globPatterns: ['**/*.{js,css,html,svg,woff2}'],
      },
    }),
  ],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  server: {
    port: 5201,
    strictPort: true,
  },
  build: {
    outDir: 'dist',
    sourcemap: true,
  },
});