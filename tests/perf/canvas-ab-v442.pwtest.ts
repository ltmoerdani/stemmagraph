/**
 * Runner A/B onlyRenderVisibleElements v442 AC4 (test-only, Playwright).
 *
 * Membandingkan mode visibility on vs off pada 5.000 node melalui host
 * bench tests/perf/host/canvas-bench.html (override dibaca visibility.ts
 * dari query param perfVisibility, perilaku app default tidak berubah).
 * Laporan di-append ke docs/perf/v442-canvas-ab.md via afterAll.
 *
 * GATE: tidak dipick vitest (pola include src/**); testMatch *.pwtest.ts.
 */
import { test, expect } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';
import {
  collectFrameStats,
  dragNodeContinuous,
  grabPoint,
  openBenchHost,
  zoomContinuous,
} from './harness-v442';
import {
  computeFpsAvg,
  computeFrameDrops,
  computeFrameDropPct,
  computeP95Delta,
  type BenchRunStats,
} from '../../src/components/FamilyTree/__perf__/perf-bench-stats';

const SAMPLE_MS = 8_000;
const RUNS = 2;
const NODES = 5000;
const MODES = ['on', 'off'] as const;

const allStats: BenchRunStats[] = [];

for (const mode of MODES) {
  test.describe(`canvas ab v442 ${NODES} node ${mode}`, () => {
    test(`drag dan zoom, ${RUNS} run, mode ${mode}`, async ({ page }) => {
      test.setTimeout(600_000);
      await openBenchHost(page, NODES, mode);

      const start = await grabPoint(page);
      for (let run = 0; run < RUNS; run += 1) {
        const evalPromise = collectFrameStats(page, SAMPLE_MS);
        if (start) await dragNodeContinuous(page, start, SAMPLE_MS);
        const { deltas } = await evalPromise;
        allStats.push({
          scenario: 'drag',
          nodes: NODES,
          fpsAvg: computeFpsAvg(deltas),
          p95DeltaMs: computeP95Delta(deltas),
          frameDrops: computeFrameDrops(deltas),
          frameDropPct: computeFrameDropPct(deltas),
          samples: deltas.length,
          mode,
        });
        expect(deltas.length).toBeGreaterThan(0);
      }

      for (let run = 0; run < RUNS; run += 1) {
        const evalPromise = collectFrameStats(page, SAMPLE_MS);
        await zoomContinuous(page, SAMPLE_MS);
        const { deltas } = await evalPromise;
        allStats.push({
          scenario: 'zoom',
          nodes: NODES,
          fpsAvg: computeFpsAvg(deltas),
          p95DeltaMs: computeP95Delta(deltas),
          frameDrops: computeFrameDrops(deltas),
          frameDropPct: computeFrameDropPct(deltas),
          samples: deltas.length,
          mode,
        });
        expect(deltas.length).toBeGreaterThan(0);
      }
    });
  });
}

test.afterAll(async () => {
  if (allStats.length === 0) return;
  const lines: string[] = [
    `# A/B onlyRenderVisibleElements v442 AC4 (append ${new Date().toISOString()})`,
    '',
    `Dataset: ${NODES} node buildPerfFamily, ${SAMPLE_MS / 1000} detik per run, ${RUNS} run per skenario, chromium headless.`,
    '',
    '| Mode | Skenario | Run | FPS | p95 delta (ms) | Frame drop (>32ms) | Drop % | Sampel |',
    '|---|---|---|---|---|---|---|---|',
  ];
  allStats.forEach((s, i) => {
    lines.push(
      `| ${s.mode} | ${s.scenario} | ${(i % RUNS) + 1} | ${s.fpsAvg.toFixed(2)} | ${s.p95DeltaMs.toFixed(2)} | ${s.frameDrops} | ${s.frameDropPct.toFixed(1)} | ${s.samples} |`,
    );
  });
  lines.push('', '## Ringkasan FPS rata-rata per mode', '');
  for (const mode of MODES) {
    for (const scenario of ['drag', 'zoom'] as const) {
      const rows = allStats.filter((s) => s.mode === mode && s.scenario === scenario);
      const fps = rows.length > 0 ? rows.reduce((a, b) => a + b.fpsAvg, 0) / rows.length : null;
      lines.push(`- mode ${mode}, ${scenario}: ${fps === null ? 'n/a' : `${fps.toFixed(2)} fps`}`);
    }
  }
  const out = path.resolve(process.cwd(), 'docs/perf/v442-canvas-ab.md');
  fs.mkdirSync(path.dirname(out), { recursive: true });
  fs.appendFileSync(out, `${lines.join('\n')}\n`);
});
