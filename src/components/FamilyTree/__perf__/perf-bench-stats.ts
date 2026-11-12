/**
 * Util statistik benchmark canvas v442 (test-only, murni tanpa DOM).
 *
 * Dipakai runner Playwright v442 (initial load, drag/zoom FPS, baseline
 * p95 + frame-drop, memory median) dan diuji vitest tanpa browser.
 * Pola p95 dan FPS mengikuti canvas-drag-stats.ts; tambahan v442:
 * frame-drop count, median, dan persentase.
 */

/** Delta rAF ke-95 persentil (ms), semantik sama dengan runner v177-ii. */
export const computeP95Delta = (values: number[]): number => {
  const sorted = [...values].sort((a, b) => a - b);
  const idx = Math.max(0, Math.ceil(sorted.length * 0.95) - 1);
  return sorted[idx] ?? 0;
};

/** FPS rata-rata dari daftar delta rAF (ms); 0 bila kosong. */
export const computeFpsAvg = (deltas: number[]): number =>
  deltas.length > 0 ? 1000 / (deltas.reduce((a, b) => a + b, 0) / deltas.length) : 0;

/**
 * Jumlah frame yang melebihi budget (ms). Budget default 32 ms
 * (setengah 60 fps dikali dua): delta di atasnya berarti render
 * setidaknya setengah laju normal, terasa sebagai tersendat.
 */
export const computeFrameDrops = (values: number[], budgetMs = 32): number =>
  values.filter((v) => v > budgetMs).length;

/** Persentase frame-drop terhadap total sampel; 0 bila kosong. */
export const computeFrameDropPct = (values: number[], budgetMs = 32): number =>
  values.length > 0 ? (computeFrameDrops(values, budgetMs) / values.length) * 100 : 0;

/** Median daftar angka; 0 bila kosong. */
export const computeMedian = (values: number[]): number => {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 1 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
};

export interface BenchRunStats {
  scenario: 'load' | 'drag' | 'zoom' | 'hover-drag';
  nodes: number;
  mode?: 'on' | 'off';
  fpsAvg: number;
  p95DeltaMs: number;
  frameDrops: number;
  frameDropPct: number;
  samples: number;
}
