/**
 * Perf harness drag canvas pasca memo edge v395 (test-only, runner Playwright).
 *
 * Mengukur FPS rata-rata dan p95 rAF delta saat drag node tunggal selama
 * 10 detik pada dataset generatif 241 dan 5000 node, 3 run per kombinasi.
 * Metodologi sama dengan runner v177-ii tests/perf/canvas-ab.pwtest.ts:
 * sampling rAF via collectFrameStats, host page tests/perf/host/canvas-drag.html
 * dilayani vite dev port 5201, laporan ditulis docs/perf/canvas-drag-report.md
 * via afterAll.
 *
 * Memo edge S-04 fase i kini aktif di build (MarriageEdge, ParentChildEdge,
 * SiblingEdge dibungkus React.memo). Tidak ada flag on-off untuk memo edge;
 * pengukuran mewakili kondisi build kini. Skenario pan/zoom diukur dalam
 * run yang sama sebagai pembanding internal (AC2) sehingga drag vs pan/zoom
 * comparable dalam satu laporan.
 *
 * GATE: test ini TIDAK dijalankan otomatis vitest (pola include vitest hanya
 * test di bawah src); testMatch playwright *.pwtest.ts anti tabrakan.
 */
import { test, expect } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';
import type { Page } from '@playwright/test';
import { computeFpsAvg, computeP95Delta, type DragRunStats } from '../../src/components/FamilyTree/__perf__/canvas-drag-stats';

const HOST_URL = 'http://localhost:5201/tests/perf/host/canvas-drag.html';
const SAMPLE_MS = 10_000;
const RUNS = 3;
const DATASETS = [241, 5000] as const;
const DRAG_REPORT = path.resolve(process.cwd(), 'docs/perf/canvas-drag-report.md');
const AB_REPORT = path.resolve(process.cwd(), 'docs/perf/canvas-ab-report.md');

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

const openHost = async (page: Page, nodes: number): Promise<void> => {
  await page.goto(`${HOST_URL}?nodes=${nodes}`, {
    waitUntil: 'domcontentloaded',
  });
  await page.waitForFunction(() => (window as unknown as { __perfReady?: boolean }).__perfReady === true, {
    timeout: 60_000,
  });
};

/** Titik awal drag: node pertama bila ketemu, cadangan pusat pane. */
const grabPoint = async (page: Page): Promise<{ x: number; y: number } | null> => {
  const node = page.locator('.react-flow__node').first();
  const nodeBox = await node.boundingBox().catch(() => null);
  if (nodeBox) {
    return { x: nodeBox.x + nodeBox.width / 2, y: nodeBox.y + nodeBox.height / 2 };
  }
  const pane = page.locator('.react-flow__pane').first();
  const paneBox = await pane.boundingBox().catch(() => null);
  if (paneBox) {
    return { x: paneBox.x + paneBox.width / 2, y: paneBox.y + paneBox.height / 2 };
  }
  return null;
};

/** Drag satu node terus-menerus sampai deadline, gerak bolak-balik kecil. */
const dragNodeContinuous = async (page: Page, durationMs: number): Promise<void> => {
  const start = await grabPoint(page);
  if (!start) return;
  await page.mouse.move(start.x, start.y);
  await page.mouse.down();
  const deadline = Date.now() + durationMs;
  let i = 0;
  while (Date.now() < deadline) {
    const offset = i % 20 < 10 ? (i % 10) * 4 : (10 - (i % 10)) * 4;
    await page.mouse.move(start.x + offset, start.y + offset / 2, { steps: 2 });
    i += 1;
  }
  await page.mouse.up();
};

/** Pan viewport di pane lalu zoom wheel, bolak-balik kontinu sampai deadline. */
const panZoomContinuous = async (page: Page, durationMs: number): Promise<void> => {
  const pane = page.locator('.react-flow__pane').first();
  const box = await pane.boundingBox().catch(() => null);
  if (!box) return;
  const cx = box.x + box.width / 2;
  const cy = box.y + box.height / 2;
  const deadline = Date.now() + durationMs;
  let phase = 0;
  while (Date.now() < deadline) {
    if (phase % 2 === 0) {
      // pan bolak-balik di pane (viewport, bukan node)
      await page.mouse.move(cx, cy);
      await page.mouse.down();
      for (let i = 0; i < 10 && Date.now() < deadline; i += 1) {
        await page.mouse.move(cx + i * 6, cy + i * 3, { steps: 2 });
      }
      for (let i = 10; i > 0 && Date.now() < deadline; i -= 1) {
        await page.mouse.move(cx + i * 6, cy + i * 3, { steps: 2 });
      }
      await page.mouse.up();
    } else {
      // zoom in lalu zoom out via wheel
      for (let i = 0; i < 10 && Date.now() < deadline; i += 1) {
        await page.mouse.wheel(0, 120);
      }
      for (let i = 0; i < 10 && Date.now() < deadline; i += 1) {
        await page.mouse.wheel(0, -120);
      }
    }
    phase += 1;
  }
};

const allStats: DragRunStats[] = [];

/** Rata-rata FPS untuk satu kombinasi skenario dan dataset; null bila kosong. */
const avg = (scenario: DragRunStats['scenario'], nodes: number): number | null => {
  const rows = allStats.filter((s) => s.scenario === scenario && s.nodes === nodes);
  return rows.length > 0 ? rows.reduce((a, b) => a + b.fpsAvg, 0) / rows.length : null;
};

for (const nodes of DATASETS) {
  test.describe(`canvas drag v395 ${nodes} node`, () => {
    test(`fps drag dan panzoom ${RUNS} run`, async ({ page }) => {
      // 6 run x 10 dtk interaksi + load host dataset 5000 node: butuh lebih dari default 120 dtk
      test.setTimeout(600_000);
      await openHost(page, nodes);
      for (let run = 0; run < RUNS; run += 1) {
        const evalPromise = collectFrameStats(page, SAMPLE_MS);
        // drag node tunggal 10 detik, sampling rAF aktif sepanjang interaksi
        await dragNodeContinuous(page, SAMPLE_MS);
        const { deltas } = await evalPromise;
        allStats.push({
          scenario: 'drag',
          nodes,
          fpsAvg: computeFpsAvg(deltas),
          p95DeltaMs: computeP95Delta(deltas),
        });
        expect(deltas.length).toBeGreaterThan(0);
      }
      for (let run = 0; run < RUNS; run += 1) {
        const evalPromise = collectFrameStats(page, SAMPLE_MS);
        // pan/zoom pembanding internal dalam run yang sama (AC2), build kini
        await panZoomContinuous(page, SAMPLE_MS);
        const { deltas } = await evalPromise;
        allStats.push({
          scenario: 'panzoom',
          nodes,
          fpsAvg: computeFpsAvg(deltas),
          p95DeltaMs: computeP95Delta(deltas),
        });
        expect(deltas.length).toBeGreaterThan(0);
      }
    });
  });
}

test.afterAll(async () => {
  if (allStats.length === 0) return;

  let refLines: string[] = [];
  let refAvailable = false;
  try {
    const ab = fs.readFileSync(AB_REPORT, 'utf8');
    refLines = ab.split('\n').filter((l) => l.startsWith('| on ') || l.startsWith('| off '));
    refAvailable = refLines.length > 0;
  } catch {
    refAvailable = false;
  }

  const lines: string[] = [
    '# Laporan Canvas Drag pasca Memo Edge v395 (S-04 fase ii)',
    '',
    `Tanggal: ${new Date().toISOString()}`,
    `Sampel: ${SAMPLE_MS / 1000} detik per run, ${RUNS} run per kombinasi, interaksi drag node tunggal 10 detik.`,
    'Kondisi: build kini dengan memo edge S-04 fase i aktif (tanpa flag on-off, non-goal).',
    '',
    '## Hasil per dataset dan skenario',
    '',
    '| Skenario | Node | FPS rata-rata | p95 rAF delta (ms) |',
    '|---|---|---|---|',
  ];
  for (const s of allStats) {
    lines.push(`| ${s.scenario} | ${s.nodes} | ${s.fpsAvg.toFixed(2)} | ${s.p95DeltaMs.toFixed(2)} |`);
  }

  lines.push('');
  lines.push('## Referensi silang angka v177-ii');
  lines.push('');
  lines.push(
    'PERINGATAN: angka berikut adalah CROSS-RUN REFERENCE, bukan A/B ketat. Memo edge tidak punya flag on-off dan memang tidak dibuatkan (non-goal); kondisi run beda sesi sehingga perbedaan bisa berasal dari noise lingkungan.',
  );
  lines.push('');
  if (refAvailable) {
    lines.push('| Mode | Node | FPS rata-rata | p95 rAF delta (ms) |');
    lines.push('|---|---|---|---|');
    for (const l of refLines) lines.push(l.trim());
  } else {
    lines.push('Laporan v177-ii docs/perf/canvas-ab-report.md tidak terbaca saat run ini; referensi tidak tersedia.');
  }

  lines.push('');
  lines.push('## Perbandingan langsung drag vs pan/zoom (pembanding internal run sama)');
  lines.push('');
  lines.push('| Node | FPS drag | FPS pan/zoom | Selisih (drag minus pan/zoom) |');
  lines.push('|---|---|---|---|');
  for (const nodes of DATASETS) {
    const d = avg('drag', nodes);
    const p = avg('panzoom', nodes);
    if (d === null || p === null) continue;
    lines.push(`| ${nodes} | ${d.toFixed(2)} | ${p.toFixed(2)} | ${(d - p).toFixed(2)} |`);
  }

  lines.push('');
  lines.push('## Kesimpulan');
  lines.push('');
  const parseRef = (nodes: number): number[] =>
    refLines
      .filter((l) => l.includes(`| ${nodes} |`))
      .map((l) => Number(l.split('|')[3]?.trim()))
      .filter((n) => Number.isFinite(n) && n > 0);
  for (const nodes of DATASETS) {
    const d = avg('drag', nodes);
    const refs = parseRef(nodes);
    if (d === null) continue;
    if (refs.length === 0) {
      lines.push(`- ${nodes} node: drag rata-rata ${d.toFixed(2)} fps; referensi v177-ii tidak tersedia, kesimpulan cross-run tidak bisa ditarik.`);
      continue;
    }
    const refMin = Math.min(...refs);
    const refMax = Math.max(...refs);
    if (d >= refMin && d <= refMax) {
      lines.push(
        `- ${nodes} node: drag rata-rata ${d.toFixed(2)} fps berada DI DALAM rentang referensi v177-ii (${refMin.toFixed(2)} sampai ${refMax.toFixed(2)}). Delta di bawah noise; tidak ada bukti perubahan kinerja drag pada kondisi build kini.`,
      );
    } else if (d > refMax) {
      lines.push(
        `- ${nodes} node: drag ${d.toFixed(2)} fps DI ATAS rentang referensi (${refMin.toFixed(2)} sampai ${refMax.toFixed(2)}); kemungkinan besar variasi sesi, bukan klaim peningkatan.`,
      );
    } else {
      lines.push(
        `- ${nodes} node: drag ${d.toFixed(2)} fps DI BAWAH rentang referensi (${refMin.toFixed(2)} sampai ${refMax.toFixed(2)}); perlu run ulang untuk konfirmasi sebelum disimpulkan regresi.`,
      );
    }
  }

  fs.mkdirSync(path.dirname(DRAG_REPORT), { recursive: true });
  fs.writeFileSync(DRAG_REPORT, `${lines.join('\n')}\n`);
});
