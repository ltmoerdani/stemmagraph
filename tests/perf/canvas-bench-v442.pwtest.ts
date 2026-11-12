/**
 * Runner benchmark canvas v442 AC2 (test-only, Playwright).
 *
 * Mengukur initial load, drag FPS, dan zoom FPS pada dataset realistis
 * 2.000 dan 5.000 node (fixture buildPerfFamily) melalui host bench
 * tests/perf/host/canvas-bench.html di vite dev port 5201. Mode
 * visibility default mengikuti threshold app (2000/5000 keduanya on).
 * Laporan ditulis docs/perf/v442-canvas-bench.md via afterAll.
 *
 * GATE: tidak dipick vitest (pola include src/**).* ; testMatch *.pwtest.ts.
 */
import { test, expect } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';
import {
  BENCH_HOST_URL,
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
const DATASETS = [2000, 5000] as const;

const loadMs: Array<{ nodes: number; ms: number }> = [];
const allStats: BenchRunStats[] = [];

for (const nodes of DATASETS) {
  test.describe(`canvas bench v442 ${nodes} node`, () => {
    test(`initial load, drag fps, zoom fps, ${RUNS} run`, async ({ page }) => {
      test.setTimeout(600_000);
      const load = await openBenchHost(page, nodes);
      loadMs.push({ nodes, ms: load });
      expect(load).toBeGreaterThan(0);

      const start = await grabPoint(page);
      for (let run = 0; run < RUNS; run += 1) {
        const evalPromise = collectFrameStats(page, SAMPLE_MS);
        if (start) await dragNodeContinuous(page, start, SAMPLE_MS);
        const { deltas } = await evalPromise;
        allStats.push({
          scenario: 'drag',
          nodes,
          fpsAvg: computeFpsAvg(deltas),
          p95DeltaMs: computeP95Delta(deltas),
          frameDrops: computeFrameDrops(deltas),
          frameDropPct: computeFrameDropPct(deltas),
          samples: deltas.length,
          mode: undefined,
        });
        expect(deltas.length).toBeGreaterThan(0);
      }

      for (let run = 0; run < RUNS; run += 1) {
        const evalPromise = collectFrameStats(page, SAMPLE_MS);
        await zoomContinuous(page, SAMPLE_MS);
        const { deltas } = await evalPromise;
        allStats.push({
          scenario: 'zoom',
          nodes,
          fpsAvg: computeFpsAvg(deltas),
          p95DeltaMs: computeP95Delta(deltas),
          frameDrops: computeFrameDrops(deltas),
          frameDropPct: computeFrameDropPct(deltas),
          samples: deltas.length,
          mode: undefined,
        });
        expect(deltas.length).toBeGreaterThan(0);
      }
    });
  });
}

test.afterAll(async () => {
  if (allStats.length === 0 && loadMs.length === 0) return;
  const lines: string[] = [
    '# Benchmark Canvas v442 AC2 (initial load, drag, zoom)',
    '',
    `Tanggal: ${new Date().toISOString()}`,`Dataset: fixture realistis buildPerfFamily (couples + parent-child, deterministik).`,
    `Sampel: ${SAMPLE_MS / 1000} detik per run, ${RUNS} run per skenario, chromium headless.`,
    '',
    '## Initial load (build data + mount + layout + render pertama)',
    '',
    '| Node | Load ms |',
    '|---|---|',
  ];
  for (const l of loadMs) lines.push(`| ${l.nodes} | ${l.ms.toFixed(1)} |`);
  lines.push('', '## Drag dan zoom (rAF sampling)', '', '| Skenario | Node | FPS | p95 delta (ms) | Frame drop (>32ms) | Drop % | Sampel |', '|---|---|---|---|---|---|---|');
  for (const s of allStats) {
    lines.push(
      `| ${s.scenario} | ${s.nodes} | ${s.fpsAvg.toFixed(2)} | ${s.p95DeltaMs.toFixed(2)} | ${s.frameDrops} | ${s.frameDropPct.toFixed(1)} | ${s.samples} |`,
    );
  }
  lines.push('');
  const avg = (scenario: BenchRunStats['scenario'], nodes: number): number | null => {
    const rows = allStats.filter((s) => s.scenario === scenario && s.nodes === nodes);
    return rows.length > 0 ? rows.reduce((a, b) => a + b.fpsAvg, 0) / rows.length : null;
  };
  lines.push('## Ringkasan FPS rata-rata', '');
  for (const nodes of DATASETS) {
    const d = avg('drag', nodes);
    const z = avg('zoom', nodes);
    lines.push(`- ${nodes} node: drag ${d === null ? 'n/a' : d.toFixed(2)} fps, zoom ${z === null ? 'n/a' : z.toFixed(2)} fps.`);
  }
  const out = path.resolve(process.cwd(), 'docs/perf/v442-canvas-bench.md');
  fs.mkdirSync(path.dirname(out), { recursive: true });
  fs.writeFileSync(out, `${lines.join('\n')}\n`);
});
