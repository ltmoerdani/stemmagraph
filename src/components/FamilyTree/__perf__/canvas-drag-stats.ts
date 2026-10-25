/**
 * Util statistik perf harness canvas v395 (test-only, murni tanpa DOM).
 *
 * Diekstrak dari pola runner canvas-ab.pwtest.ts v177-ii supaya logika
 * p95, FPS rata-rata, dan format laporan bisa diuji vitest tanpa browser.
 * Dipakai bersama oleh runner Playwright tests/perf/canvas-drag.pwtest.ts
 * dan suite vitest di folder ini.
 */

/** Delta rAF ke-95 persentil, semantik sama dengan runner v177-ii. */
export const computeP95Delta = (values: number[]): number => {
  const sorted = [...values].sort((a, b) => a - b);
  const idx = Math.max(0, Math.ceil(sorted.length * 0.95) - 1);
  return sorted[idx] ?? 0;
};

/** FPS rata-rata dari daftar delta rAF (ms); 0 bila kosong. */
export const computeFpsAvg = (deltas: number[]): number =>
  deltas.length > 0 ? 1000 / (deltas.reduce((a, b) => a + b, 0) / deltas.length) : 0;

export interface DragRunStats {
  scenario: 'drag' | 'panzoom';
  nodes: number;
  fpsAvg: number;
  p95DeltaMs: number;
}
