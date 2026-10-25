/**
 * Test util statistik perf drag canvas v395 (test-only).
 *
 * Kasus baru suite perf: memastikan semantik p95, FPS rata-rata, dan
 * tipe statistik yang dipakai runner Playwright v395 benar sebelum
 * dipakai menyusun laporan docs/perf/canvas-drag-report.md.
 */
import { describe, expect, it } from 'vitest';
import { computeFpsAvg, computeP95Delta, type DragRunStats } from './canvas-drag-stats';

describe('canvas drag stats util (v395) [perf]', () => {
  it('computeP95Delta: urut naik lalu ambil indeks ceil(0.95n) minus satu', () => {
    expect(computeP95Delta([1, 2, 3, 4, 5, 6, 7, 8, 9, 10])).toBe(10);
    expect(computeP95Delta([20, 16, 66, 50, 33, 40])).toBe(66);
    expect(computeP95Delta([42])).toBe(42);
    expect(computeP95Delta([])).toBe(0);
  });

  it('computeFpsAvg: delta 16.67 ms dua sampel sekitar 40 fps, kosong 0', () => {
    const deltas = Array.from({ length: 60 }, () => 1000 / 60);
    expect(computeFpsAvg(deltas)).toBeCloseTo(60, 5);
    expect(computeFpsAvg([16.67, 33.33])).toBeCloseTo(40, 1);
    expect(computeFpsAvg([])).toBe(0);
  });

  it('DragRunStats: skenario drag dan panzoom dapat dicatat sebagai statistik', () => {
    const samples: DragRunStats[] = [
      { scenario: 'drag', nodes: 241, fpsAvg: 55.5, p95DeltaMs: 20.1 },
      { scenario: 'panzoom', nodes: 241, fpsAvg: 58.2, p95DeltaMs: 18.4 },
    ];
    expect(samples).toHaveLength(2);
    expect(samples.every((s) => s.fpsAvg >= 0 && s.p95DeltaMs >= 0)).toBe(true);
  });
});
