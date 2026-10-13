import { defineConfig, devices } from '@playwright/test';

/**
 * Konfigurasi Playwright untuk perf harness v177-ii (canvas A/B on-off).
 *
 * Hanya menyentuh tests/perf dengan pola *.pwtest.ts supaya vitest
 * (include src/**/*.test.ts(x)) tidak mem-pick berkas ini, dan sebaliknya
 * Playwright tidak mem-pick suite vitest. Server app dijalankan lewat
 * vite dev di port 5201 (sesuai vite.config.ts).
 */
export default defineConfig({
  testDir: './tests/perf',
  testMatch: '**/*.pwtest.ts',
  timeout: 120_000,
  retries: 0,
  workers: 1,
  reporter: [['list']],
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
  webServer: {
    command: 'npm run dev',
    url: 'http://localhost:5201/',
    reuseExistingServer: true,
    timeout: 120_000,
  },
});
