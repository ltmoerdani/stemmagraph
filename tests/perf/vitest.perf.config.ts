import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vitest/config';

// Konfigurasi vitest khusus benchmark perf v447 (test-only).
// Terpisah dari vitest.config.ts supaya suite utama (src/**) tidak
// ikut ter-load saat menjalankan baseline tests/perf, dan sebaliknya
// baseline perf tidak ikut saat `vitest run` suite utama.
export default defineConfig({
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('../../src', import.meta.url)),
    },
  },
  test: {
    environment: 'node',
    include: ['tests/perf/**/*.test.ts'],
    testTimeout: 120000,
  },
});
