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
  probeBeginFrame,
  sampleHeapAfterGc,
  zoomContinuous,
} from './harness-v442';
import {
  computeFpsAvg,
  computeFrameDrops,
  computeFrameDropPct,
  computeMedian,
  computeP95Delta,
  type BenchRunStats,
} from '../../src/components/FamilyTree/__perf__/perf-bench-stats';

const SAMPLE_MS = 8_000;
const RUNS = 2;
const DATASETS = [2000, 5000] as const;

const loadMs: Array<{ nodes: number; ms: number }> = [];
const allStats: BenchRunStats[] = [];
const heapRows: Array<{ nodes: number; medianMb: number; samples: number[] }> = [];
let beginFrameAvailable = false;

for (const nodes of DATASETS) {
  test.describe(`canvas bench v442 ${nodes} node`, () => {
    test(`initial load, hover-drag, drag fps, zoom fps, heap, ${RUNS} run`, async ({ page }) => {
      test.setTimeout(600_000);
      const beginFrameOk = await probeBeginFrame(page);
      if (beginFrameOk) beginFrameAvailable = true;
      const load = await openBenchHost(page, nodes);
      loadMs.push({ nodes, ms: load });
      expect(load).toBeGreaterThan(0);

      // AC3 hover: node hub ber-edge banyak (24 edge) di-hover stabil, drag
      // node lain berjalan paralel; mengukur biaya re-render adjacency.
      const hubSelector = '[data-id="perf-hub"]';
      const hubPoint = await grabPoint(page, hubSelector);
      const altPoint = await grabPoint(page, '.react-flow__node >> nth=3');
      for (let run = 0; run < RUNS; run += 1) {
        if (hubPoint) {
          await page.mouse.move(hubPoint.x, hubPoint.y);
          await page.mouse.move(hubPoint.x + 1, hubPoint.y + 1);
        }
        const evalPromise = collectFrameStats(page, SAMPLE_MS);
        if (altPoint) await dragNodeContinuous(page, altPoint, SAMPLE_MS);
        const { deltas } = await evalPromise;
        allStats.push({
          scenario: 'hover-drag',
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

      // AC3 memory: 3 sampel usedJSHeapSize pasca GC manual, median dilapor.
      const heapSamples = await sampleHeapAfterGc(page, 3);
      if (heapSamples.length > 0) {
        heapRows.push({
          nodes,
          medianMb: computeMedian(heapSamples) / (1024 * 1024),
          samples: heapSamples,
        });
      }
    });
  });
}


test.afterAll(async () => {
  if (allStats.length === 0 && loadMs.length === 0) return;
  const lines: string[] = [
    `# Benchmark Canvas v442 AC3 (append ${new Date().toISOString()})`,
    '',
    'Dataset: fixture realistis buildPerfFamily (couples + parent-child, deterministik).',
    `Sampel: ${SAMPLE_MS / 1000} detik per run, ${RUNS} run per skenario, chromium headless.`,
    `beginFrame CDP HeadlessExperimental: ${beginFrameAvailable ? 'tersedia' : 'tidak tersedia, sampling via rAF'}.`,
    '',
    '## Initial load (build data + mount + layout + render pertama)',
    '',
    '| Node | Load ms |',
    '|---|---|',
  ];
  for (const l of loadMs) lines.push(`| ${l.nodes} | ${l.ms.toFixed(1)} |`);
  lines.push('', '## Skenario rAF (drag, zoom, hover-drag)', '', '| Skenario | Node | FPS | p95 delta (ms) | Frame drop (>32ms) | Drop % | Sampel |', '|---|---|---|---|---|---|---|');
  for (const s of allStats) {
    lines.push(
      `| ${s.scenario} | ${s.nodes} | ${s.fpsAvg.toFixed(2)} | ${s.p95DeltaMs.toFixed(2)} | ${s.frameDrops} | ${s.frameDropPct.toFixed(1)} | ${s.samples} |`,
    );
  }
  lines.push('', '## Memory usedJSHeapSize pasca GC manual (median 3 sampel)', '', '| Node | Median MB | Sampel byte |', '|---|---|---|');
  if (heapRows.length === 0) {
    lines.push('| - | - | metric tidak tersedia |');
  }
  for (const h of heapRows) {
    lines.push(`| ${h.nodes} | ${h.medianMb.toFixed(1)} | ${h.samples.join(', ')} |`);
  }
  lines.push('');
  const avg = (scenario: BenchRunStats['scenario'], nodes: number): number | null => {
    const rows = allStats.filter((s) => s.scenario === scenario && s.nodes === nodes);
    return rows.length > 0 ? rows.reduce((a, b) => a + b.fpsAvg, 0) / rows.length : null;
  };
  lines.push('## Ringkasan FPS rata-rata', '');
  for (const nodes of DATASETS) {
    const d = avg('drag', nodes);
    const hd = avg('hover-drag', nodes);
    const z = avg('zoom', nodes);
    lines.push(
      `- ${nodes} node: drag ${d === null ? 'n/a' : d.toFixed(2)} fps, hover-drag ${hd === null ? 'n/a' : hd.toFixed(2)} fps, zoom ${z === null ? 'n/a' : z.toFixed(2)} fps.`,
    );
  }
  const out = path.resolve(process.cwd(), 'docs/perf/v442-canvas-bench.md');
  fs.mkdirSync(path.dirname(out), { recursive: true });
  fs.appendFileSync(out, `${lines.join('\n')}\n`);
});
