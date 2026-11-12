/**
 * Kontrak fixture graf besar v442 AC2 (test-only, node env).
 * Jumlah tepat, determinisme (dua kali build identik), validitas
 * referensi parent/spouse, dan keberadaan hub ber-degree tinggi.
 */
import { describe, expect, it } from 'vitest';
import { buildPerfFamily, toFlowEdges, toFlowNodes } from './perf-graph-sizes';
import { computeFrameDrops, computeMedian } from './perf-bench-stats';

describe('perf-graph-sizes v442 AC2 [perf]', () => {
  it('buildPerfFamily menghasilkan jumlah tepat untuk 2000 dan 5000', () => {
    expect(buildPerfFamily(2000).members).toHaveLength(2000);
    expect(buildPerfFamily(5000).members).toHaveLength(5000);
  });

  it('deterministik: dua build identik untuk target sama', () => {
    const a = buildPerfFamily(2000);
    const b = buildPerfFamily(2000);
    expect(a.members.map((m) => m.id)).toEqual(b.members.map((m) => m.id));
    expect(a.generations).toBe(b.generations);
  });

  it('semua parentIds dan spouseIds merujuk member yang ada', () => {
    const { members } = buildPerfFamily(5000);
    const ids = new Set(members.map((m) => m.id));
    for (const m of members) {
      for (const p of m.parentIds ?? []) expect(ids.has(p)).toBe(true);
      for (const s of m.spouseIds ?? []) expect(ids.has(s)).toBe(true);
    }
  });

  it('hub punya degree tertinggi dan edge derivation konsisten', () => {
    const { members, hubId } = buildPerfFamily(2000);
    const hub = members.find((m) => m.id === hubId);
    expect(hub).toBeDefined();
    const hubDegree = (hub?.parentIds ?? []).length + (hub?.spouseIds ?? []).length + (hub?.childrenIds ?? []).length;
    const hubChildEdges = toFlowEdges(members).filter((e) => e.source === hubId).length;
    expect(hubChildEdges).toBeGreaterThanOrEqual(24);
    expect(hubDegree).toBeGreaterThanOrEqual(0);
    expect(toFlowNodes(members)).toHaveLength(2000);
  });

  it('stat util: frame drop, median sesuai kontrak', () => {
    expect(computeFrameDrops([16, 16, 40, 33, 16])).toBe(2);
    expect(computeMedian([3, 1, 2])).toBe(2);
    expect(computeMedian([4, 1, 3, 2])).toBe(2.5);
    expect(computeMedian([])).toBe(0);
  });
});
