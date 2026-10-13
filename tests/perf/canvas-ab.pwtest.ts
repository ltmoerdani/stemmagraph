/**
 * Perf harness canvas A/B on-off v177-ii (test-only, runner Playwright).
 *
 * Mengukur FPS rata-rata dan p95 rAF delta saat drag node dan pan/zoom
 * pada dataset generatif 241 dan 5000 node, mode visibility on vs off,
 * via halaman host tests/perf/host/canvas-ab.html dilayani vite dev
 * (port 5201). Hasil ditulis docs/perf/canvas-ab-report.md.
 *
 * GATE: test ini TIDAK dijalankan otomatis vitest (include vitest hanya
 * src/**/*.test.ts(x)); testMatch playwright *.pwtest.ts anti tabrakan.
 * Bila lingkungan tanpa browser chromium, playwright run sekali dan
 * hasil SKIP dicatat jujur di laporan.
 */
import { test, expect } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';
import type { Page } from '@playwright/test';

const HOST_URL = 'http://localhost:5201/tests/perf/host/canvas-ab.html';
const SAMPLE_MS = 10_000;
const RUNS = 3;
const DATASETS = [241, 5000] as const;
const MODES = ['on', 'off'] as const;

interface RunStats {
  mode: 'on' | 'off';
  nodes: number;
  fpsAvg: number;
  p95DeltaMs: number;
}

const p95 = (values: number[]): number => {
  const sorted = [...values].sort((a, b) => a - b);
  const idx = Math.max(0, Math.ceil(sorted.length * 0.95) - 1);
  return sorted[idx];
};

const collectFrameStats = async (page: Page, durationMs: number): Promise<{ deltas: number[] }> => {
  return page.evaluate(
    (dur) =>
      new Promise<{ deltas: number[] }>((resolve) => {
        const deltas: number[] = [];
        const start = performance.now();
        let last = start;
        const tick = (now: number) => {
          deltas.push(now - last);
          last = now;
          if (now - start < dur) {
            requestAnimationFrame(tick);
          } else {
            resolve({ deltas });
          }
        };
        requestAnimationFrame(tick);
      }),
    durationMs,
  );
};

const statsToRun = (mode: 'on' | 'off', nodes: number, deltas: number[]): RunStats => ({
  mode,
  nodes,
  fpsAvg: deltas.length > 0 ? 1000 / (deltas.reduce((a, b) => a + b, 0) / deltas.length) : 0,
  p95DeltaMs: p95(deltas),
});

const openHost = async (page: Page, nodes: number, mode: 'on' | 'off'): Promise<void> => {
  await page.goto(`${HOST_URL}?nodes=${nodes}&perfVisibility=${mode}`, {
    waitUntil: 'domcontentloaded',
  });
  await page.waitForFunction(() => (window as unknown as { __perfReady?: boolean }).__perfReady === true, {
    timeout: 60_000,
  });
};

const dragNode = async (page: Page): Promise<void> => {
  const canvas = page.locator('.react-flow__pane').first();
  const box = await canvas.boundingBox();
  if (!box) return;
  const cx = box.x + box.width / 2;
  const cy = box.y + box.height / 2;
  await page.mouse.move(cx, cy);
  await page.mouse.down();
  for (let i = 0; i < 20; i += 1) {
    await page.mouse.move(cx + i * 6, cy + i * 3);
  }
  for (let i = 20; i > 0; i -= 1) {
    await page.mouse.move(cx + i * 6, cy + i * 3);
  }
  await page.mouse.up();
};

const panZoom = async (page: Page): Promise<void> => {
  const canvas = page.locator('.react-flow__pane').first();
  const box = await canvas.boundingBox();
  if (!box) return;
  const cx = box.x + box.width / 2;
  const cy = box.y + box.height / 2;
  for (let i = 0; i < 10; i += 1) {
    await page.mouse.wheel(0, 120);
  }
  for (let i = 0; i < 10; i += 1) {
    await page.mouse.wheel(0, -120);
  }
  await page.mouse.move(cx, cy);
  await page.mouse.down();
  await page.mouse.move(cx - 300, cy - 150, { steps: 20 });
  await page.mouse.move(cx, cy, { steps: 20 });
  await page.mouse.up();
};

const allStats: RunStats[] = [];

for (const nodes of DATASETS) {
  for (const mode of MODES) {
    test.describe(`canvas A/B ${mode} ${nodes} node`, () => {
      test(`fps drag dan pan-zoom ${RUNS} run`, async ({ page }) => {
        await openHost(page, nodes, mode);
        for (let run = 0; run < RUNS; run += 1) {
          const evalPromise = collectFrameStats(page, SAMPLE_MS);
          // interaksi berjalan selama sampling rAF aktif
          await dragNode(page);
          await panZoom(page);
          const { deltas } = await evalPromise;
          allStats.push(statsToRun(mode, nodes, deltas));
          expect(deltas.length).toBeGreaterThan(0);
        }
      });
    });
  }
}

test.afterAll(async () => {
  if (allStats.length === 0) return;
  const lines: string[] = [
    '# Laporan Canvas A/B on-off v177-ii',
    '',
    `Tanggal: ${new Date().toISOString()}`,``,
    `Sampel: ${SAMPLE_MS / 1000} detik per run, ${RUNS} run per kombinasi, interaksi drag + pan/zoom.`,
    '',
    '| Mode | Node | FPS rata-rata | p95 rAF delta (ms) |',
    '|---|---|---|---|',
  ];
  for (const s of allStats) {
    lines.push(`| ${s.mode} | ${s.nodes} | ${s.fpsAvg.toFixed(2)} | ${s.p95DeltaMs.toFixed(2)} |`);
  }
  lines.push('');
  lines.push('Catatan: mode on memaksa onlyRenderVisibleElements aktif, off mematikan;');
  lines.push('default app tanpa query param tidak berubah (override hanya di host perf).');
  const out = path.resolve(__dirname, '../../docs/perf/canvas-ab-report.md');
  fs.mkdirSync(path.dirname(out), { recursive: true });
  fs.writeFileSync(out, `${lines.join('\n')}\n`);
});
