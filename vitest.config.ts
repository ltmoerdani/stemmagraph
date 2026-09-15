import { defineConfig } from 'vitest/config'

// Fondasi test suite Stemmagraph (S-15).
// Lingkungan node: seluruh test menguji modul murni tanpa DOM.
// Pemakaian vitest.config.ts (bukan menumpuk vite.config.ts) supaya
// konfigurasi build aplikasi tidak ikut di-load saat menjalankan test.
export default defineConfig({
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts'],
  },
})
