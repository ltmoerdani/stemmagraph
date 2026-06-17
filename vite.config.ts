import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
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
  plugins: [react()],
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