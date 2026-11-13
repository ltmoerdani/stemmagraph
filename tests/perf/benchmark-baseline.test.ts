/**
 * Benchmark baseline render canvas v447 (test-only).
 *
 * Menjalankan harness render-harness.ts pada fixture 2000 dan 5000
 * node memakai builder perf-graph-fixtures dari __perf__. Callback
 * render mensimulasikan pass render canvas murni (transformasi data
 * node dan edge), biaya dominan layout React Flow tanpa DOM karena
 * environment test node.
 *
 * Metodologi: 100 frame per run, 3 repetisi per ukuran. Frame awal
 * berisiko bias JIT dan GC sporadis di server shared; repetisi ganda
 * membuat median lintas run stabil untuk baseline.
 *
 * Angka yang dicetak konsol adalah hasil run nyata dan menjadi
 * baseline terdokumentasi di docs/perf/v447-benchmark-baseline.md.
 */
import { describe, expect, it } from 'vitest';
import {
  buildPerfEdge,
  buildPerfNode,
} from '@/components/FamilyTree/__perf__/perf-graph-fixtures';
import {
  LONG_TASK_THRESHOLD_MS,
  runRenderBenchmark,
  sampleHeapMedianBytes,
  type RenderBenchmarkResult,
} from './render-harness';

interface PerfGraph {
  nodes: ReturnType<typeof buildPerfNode>[];
  edges: ReturnType<typeof buildPerfEdge>[];
}

/**
 * Fixture graf besar bercabang tiga per generasi: BFS dari root,
 * tiap non-root punya satu parent sehingga edges = nodes - 1.
 */
const buildLargeGraph = (total: number, prefix: string): PerfGraph => {
  const nodes: PerfGraph['nodes'] = [buildPerfNode(`${prefix}-0`, 0)];
  const edges: PerfGraph['edges'] = [];
  const parentIds: string[] = [`${prefix}-0`];
  const gens: number[] = [0];
  let next = 1;
  let cursor = 0;
  while (next < total) {
    const pid = parentIds[cursor];
    const pgen = gens[cursor];
    for (let k = 0; k < 3 && next < total; k += 1) {
      const id = `${prefix}-${next}`;
      nodes.push(buildPerfNode(id, pgen + 1, [pid]));
      edges.push(buildPerfEdge(`${prefix}-e${next}`, pid, id));
      parentIds.push(id);
      gens.push(pgen + 1);
      next += 1;
    }
    cursor += 1;
  }
  return { nodes, edges };
};

/**
 * Pass render murni: transformasi data node dan edge. Akumulator
 * ditampung ke sink modul supaya tidak dioptimasi keluar oleh engine.
 */
let sink = 0;

const renderPass = (graph: PerfGraph): number => {
  let acc = 0;
  for (const node of graph.nodes) {
    acc += node.position.x + node.position.y + node.data.member.generation;
    if (node.data.member.parentIds) acc += node.data.member.parentIds.length;
  }
  for (const edge of graph.edges) {
    acc += edge.source.length + edge.target.length;
  }
  return acc;
};

const FRAMES = 100;
const REPETISI = 3;

const logResult = (rep: number, res: RenderBenchmarkResult): void => {
  const fmt = (v: number | null) => (v === null ? 'n/a' : v.toFixed(4));
  console.log(
    `[v447] ${res.label} rep${rep}: frames=${res.frameTimesMs.length} avg=${fmt(res.avgFrameMs)}ms p95=${fmt(res.p95FrameMs)}ms p99=${fmt(res.p99FrameMs)}ms longTask>${LONG_TASK_THRESHOLD_MS}ms=${res.longTaskCount} heap=${res.heapMedianBytes === null ? 'n/a' : String(res.heapMedianBytes)} ts=${res.timestampSource}`
  );
};

const runRepetisi = async (
  label: string,
  total: number,
  prefix: string,
  frames = FRAMES,
  reps = REPETISI
): Promise<RenderBenchmarkResult[]> => {
  const graph = buildLargeGraph(total, prefix);
  const results: RenderBenchmarkResult[] = [];
  for (let rep = 1; rep <= reps; rep += 1) {
    const res = await runRenderBenchmark({
      label: `${label}-r${rep}`,
      frames,
      renderFrame: () => {
        sink += renderPass(graph);
      },
    });
    logResult(rep, res);
    results.push(res);
  }
  return results;
};

const expectWaras = (res: RenderBenchmarkResult, frames: number): void => {
  expect(res.measureCount).toBe(frames);
  expect(res.frameTimesMs).toHaveLength(frames);
  for (const t of res.frameTimesMs) {
    expect(Number.isFinite(t)).toBe(true);
    expect(t).toBeGreaterThanOrEqual(0);
  }
  const totalMs = res.frameTimesMs.reduce((a, b) => a + b, 0);
  expect(totalMs).toBeGreaterThan(0);
  expect(res.avgFrameMs).not.toBeNull();
  expect(res.p95FrameMs).not.toBeNull();
  expect(res.p99FrameMs).not.toBeNull();
};

describe('v447 benchmark baseline render canvas [perf]', () => {
  it(
    'baseline 2000 node: ' +
      String(REPETISI) +
      ' repetisi x ' +
      String(FRAMES) +
      ' frame, statistik waras',
    async () => {
      const results = await runRepetisi('v447-n2000', 2000, 'v447-n2000');
      expect(results).toHaveLength(REPETISI);
      for (const res of results) expectWaras(res, FRAMES);
    }
  );

  it(
    'baseline 5000 node: ' +
      String(REPETISI) +
      ' repetisi x ' +
      String(FRAMES) +
      ' frame, statistik waras',
    async () => {
      const results = await runRepetisi('v447-n5000', 5000, 'v447-n5000');
      expect(results).toHaveLength(REPETISI);
      for (const res of results) expectWaras(res, FRAMES);
    }
  );

  it('guard harness: entri User Timing terbentuk, angka finite non-zero', async () => {
    const results = await runRepetisi('v447-guard', 15, 'v447-guard', 5, 1);
    expect(results).toHaveLength(1);
    const res = results[0];
    expect(res?.measureCount).toBe(5);
    expect(res?.frameTimesMs.length).toBe(5);
    for (const t of res?.frameTimesMs ?? []) {
      expect(Number.isFinite(t)).toBe(true);
    }
    expect(res?.longTaskCount).toBe(0);
    expect(res?.timestampSource).toBe('performance.now');

    // Kontrak User Timing langsung: mark lalu measure terbaca kembali.
    performance.mark('v447-direct:start');
    sink += renderPass(buildLargeGraph(15, 'v447-direct'));
    performance.mark('v447-direct:end');
    performance.measure('v447-direct', 'v447-direct:start', 'v447-direct:end');
    const entries = performance.getEntriesByName('v447-direct');
    expect(entries.length).toBe(1);
    expect(entries[0]?.duration ?? -1).toBeGreaterThanOrEqual(0);
    performance.clearMarks('v447-direct:start');
    performance.clearMarks('v447-direct:end');
    performance.clearMeasures('v447-direct');

    // Sink terpakai nyata: akumulasi pass render harus positif.
    expect(sink).toBeGreaterThan(0);
  });

  it('heap: median tiga sampel atau null bila API tidak tersedia', async () => {
    const heap = await sampleHeapMedianBytes();
    expect(heap === null || (Number.isFinite(heap) && heap > 0)).toBe(true);
  });
});
