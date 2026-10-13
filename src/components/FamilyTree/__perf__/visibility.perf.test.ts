/**
 * Perf harness v177-i fase prep (test-only).
 *
 * Mengukur biaya pemanggilan shouldOnlyRenderVisibleElements pada
 * ukuran graf 15 / 255 / 241 / 5000 sebagai baseline. Pengukuran
 * render React Flow yang sesungguhnya menyusul di v177-ii lewat
 * runner browser.
 */
import { describe, expect, it } from 'vitest';
import { shouldOnlyRenderVisibleElements } from '../generations/visibility';
import {
  buildHarnessAliases,
  buildHarnessBinary,
  buildHarnessWide,
} from './perf-graph-fixtures';

const HARNESS_ALIASES = buildHarnessAliases();
const HARNESS_BINARY = buildHarnessBinary();
const HARNESS_WIDE = buildHarnessWide();

const PERF_SIZES = [15, 255, 241, 5000];

const measureFrame = (count: number) => {
  performance.mark(`v177:start-${count}`);
  shouldOnlyRenderVisibleElements(count);
  performance.mark(`v177:end-${count}`);
  performance.measure(`v177:${count}`, `v177:start-${count}`, `v177:end-${count}`);
  return performance.getEntriesByName(`v177:${count}`).pop()?.duration ?? 0;
};

describe('FamilyTree perf harness (v177-i fase prep) [perf]', () => {
  it('kontrak tiga harness sesuai spesifikasi v177-i', () => {
    expect(HARNESS_ALIASES.nodes).toHaveLength(15);
    expect(HARNESS_ALIASES.edges).toHaveLength(14);
    expect(HARNESS_BINARY.nodes).toHaveLength(255);
    expect(HARNESS_BINARY.edges).toHaveLength(254);
    expect(HARNESS_WIDE.nodes).toHaveLength(241);
    expect(HARNESS_WIDE.edges).toHaveLength(240);
  });

  it('threshold decision visibility: 499 off, 500 on, 0 off', () => {
    expect(shouldOnlyRenderVisibleElements(499)).toBe(false);
    expect(shouldOnlyRenderVisibleElements(500)).toBe(true);
    expect(shouldOnlyRenderVisibleElements(0)).toBe(false);
  });

  it('baseline pengukuran empat ukuran graf terkumpul', () => {
    const samples: number[] = [];
    for (const size of PERF_SIZES) {
      samples.push(measureFrame(size));
    }
    expect(samples).toHaveLength(4);
    expect(samples.every((sample) => typeof sample === 'number' && sample >= 0)).toBe(true);
  });

  it('laporan keputusan baseline tercetak dan terbaca', () => {
    const samples: number[] = PERF_SIZES.map((size) => measureFrame(size));
    const report = samples.map(
      (duration, i) => `harness ${['15', '255', '241', '5000'][i]}: ${duration.toFixed(4)} ms`
    );
    console.log(`v177-i baseline:\n${report.join('\n')}`);
    expect(report.join('\n')).toContain('harness 15');
  });

  it('kasus eksperimen on-off 241 node untuk desain A/B v177-ii', () => {
    // Eksperimen A/B live vs simulasi ekor disusul di v177-ii: 241 node
    // masih di bawah threshold 500 sehingga culling off, sementara ekor
    // 5000 node hipotesis menyalakannya. Bandingkan hasil render live
    // dengan simulasi cabang ekor ini sebelum mengubah threshold.
    expect(shouldOnlyRenderVisibleElements(241)).toBe(false);
    expect(shouldOnlyRenderVisibleElements(5000)).toBe(true);
  });
});
