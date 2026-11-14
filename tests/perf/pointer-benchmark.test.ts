/**
 * Benchmark interaksi pointer v452 (test-only, fase 2 v447).
 *
 * Mengukur biaya pemrosesan event pointer (hover dan drag) atas data
 * graf keluarga, biaya dominan sebelum commit React. Environment test
 * node murni tanpa DOM: PointerEvent constructor tidak tersedia di
 * node v20 (terverifikasi wake-318), sehingga harness dua jalur:
 * native PointerEvent bila ada (runner browser), fallback Event
 * sintetis dengan field pointer di-assign via Object.assign dan cast
 * tipe eksplisit. tsconfig aplikasi tidak disentuh.
 *
 * Metodologi mengikuti v447: 100 frame terukur per repetisi, 3
 * repetisi per ukuran, warmup 3 frame, User Timing mark/measure,
 * long task di atas 50 ms, dataset seed tetap (LCG seed konstanta)
 * supaya lintas run comparable dengan baseline v447.
 */
import { describe, expect, it } from 'vitest';
import {
  buildPerfEdge,
  buildPerfNode,
} from '@/components/FamilyTree/__perf__/perf-graph-fixtures';
import {
  LONG_TASK_THRESHOLD_MS,
  runRenderBenchmark,
  type RenderBenchmarkResult,
} from './render-harness';

interface PerfGraph {
  nodes: ReturnType<typeof buildPerfNode>[];
  edges: ReturnType<typeof buildPerfEdge>[];
}

/**
 * Fixture graf bercabang tiga per generasi, identik pola baseline
 * v447 (edges = nodes - 1) supaya angka pointer comparable dengan
 * angka render baseline.
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
 * LCG deterministik (seed konstanta 42): koordinat lompat pointer
 * reproducible lintas run dan lintas mesin, syarat perbandingan delta
 * sebelum dan sesudah optimasi.
 */
const makeRng = (seed: number): (() => number) => {
  let state = seed >>> 0;
  return (): number => {
    state = (Math.imul(state, 1664525) + 1013904223) >>> 0;
    return state / 4294967296;
  };
};

/** Field pointer minimal yang dibaca pipeline interaksi. */
interface PointerInit {
  pointerId: number;
  pointerType: string;
  isPrimary: boolean;
  clientX: number;
  clientY: number;
  buttons: number;
}

type PointerEventLike = Event & PointerInit;

interface NativePointerEventCtor {
  new (type: string, init?: PointerInit): PointerEventLike;
}

/**
 * Dua jalur konstruksi event: native bila runner menyediakan
 * PointerEvent (browser), fallback Event sintetis di node (constructor
 * undefined di node v20 murni). Cast via unknown, bukan any lepas.
 */
const createPointerEvent = (type: string, init: PointerInit): PointerEventLike => {
  const Ctor = (globalThis as unknown as { PointerEvent?: NativePointerEventCtor })
    .PointerEvent;
  if (typeof Ctor === 'function') {
    return new Ctor(type, init);
  }
  const ev = new Event(type) as unknown as PointerEventLike;
  Object.assign(ev, init);
  return ev;
};

/**
 * Guard getCoalescedEvents: limited availability (MDN), wajib cek
 * fungsi sebelum dipanggil. Bila ada, batch coalesced ikut diproses
 * (pola pointer pipeline nyata); bila tidak, event tunggal.
 */
const coalescedOf = (ev: PointerEventLike): PointerEventLike[] => {
  const getter = (ev as unknown as {
    getCoalescedEvents?: () => PointerEventLike[];
  }).getCoalescedEvents;
  if (typeof getter === 'function') {
    const batch = getter.call(ev);
    return batch.length > 0 ? batch : [ev];
  }
  return [ev];
};

/** Hit test O(n): node terdekat ke koordinat pointer (kuadrat jarak). */
const hitTestNearest = (graph: PerfGraph, x: number, y: number): number => {
  let best = -1;
  let bestDist = Number.POSITIVE_INFINITY;
  for (let i = 0; i < graph.nodes.length; i += 1) {
    const n = graph.nodes[i];
    const dx = n.position.x - x;
    const dy = n.position.y - y;
    const d = dx * dx + dy * dy;
    if (d < bestDist) {
      bestDist = d;
      best = i;
    }
  }
  return best;
};

/**
 * Pass hover satu frame: pointermove ke koordinat baru, hit test,
 * proses handler enter/leave node terdampak (baca field data member,
 * pola cost handler UI ringan).
 */
const hoverFrame = (graph: PerfGraph, rng: () => number, state: { hovered: number; sink: number }): void => {
  const x = (rng() - 0.5) * 3000;
  const y = (rng() - 0.5) * 2400;
  const ev = createPointerEvent('pointermove', {
    pointerId: 1,
    pointerType: 'mouse',
    isPrimary: true,
    clientX: x,
    clientY: y,
    buttons: 0,
  });
  for (const c of coalescedOf(ev)) {
    const idx = hitTestNearest(graph, c.clientX, c.clientY);
    if (idx !== state.hovered) {
      state.hovered = idx;
      const node = graph.nodes[idx];
      if (node) {
        state.sink += node.data.member.generation;
        if (node.data.member.parentIds) state.sink += node.data.member.parentIds.length;
      }
    }
  }
};

/**
 * Pass drag satu frame: pointermove dengan lompatan koordinat,
 * posisi node ter-drag diperbarui, edge yang menyentuhnya dihitung
 * ulang (panjang id source dan target, pola cost recompute layout).
 */
const dragFrame = (graph: PerfGraph, rng: () => number, dragged: number, sinkBox: { sink: number }): void => {
  const ev = createPointerEvent('pointermove', {
    pointerId: 1,
    pointerType: 'mouse',
    isPrimary: true,
    clientX: (rng() - 0.5) * 3000,
    clientY: (rng() - 0.5) * 2400,
    buttons: 1,
  });
  for (const c of coalescedOf(ev)) {
    const node = graph.nodes[dragged];
    if (node) {
      node.position.x = c.clientX;
      node.position.y = c.clientY;
    }
  }
  for (const edge of graph.edges) {
    if (edge.source === graph.nodes[dragged]?.id || edge.target === graph.nodes[dragged]?.id) {
      sinkBox.sink += edge.source.length + edge.target.length;
    }
  }
};

interface ScenResult {
  hover: RenderBenchmarkResult[];
  drag: RenderBenchmarkResult[];
}

const FRAMES = 100;
const REPETISI = 3;
const SEED = 42;

const logResult = (tag: string, rep: number, res: RenderBenchmarkResult): void => {
  const fmt = (v: number | null): string => (v === null ? 'n/a' : v.toFixed(4));
  console.log(
    `[v452] ${res.label} ${tag} rep${rep}: frames=${res.frameTimesMs.length} avg=${fmt(res.avgFrameMs)}ms p95=${fmt(res.p95FrameMs)}ms p99=${fmt(res.p99FrameMs)}ms longTask>${LONG_TASK_THRESHOLD_MS}ms=${res.longTaskCount} ts=${res.timestampSource}`
  );
};

const runScenario = async (total: number, prefix: string): Promise<ScenResult> => {
  const graph = buildLargeGraph(total, prefix);

  const hover: RenderBenchmarkResult[] = [];
  for (let rep = 1; rep <= REPETISI; rep += 1) {
    const rng = makeRng(SEED);
    const state = { hovered: -1, sink: 0 };
    const res = await runRenderBenchmark({
      label: `${prefix}-hover-r${rep}`,
      frames: FRAMES,
      renderFrame: () => hoverFrame(graph, rng, state),
    });
    logResult('hover', rep, res);
    hover.push(res);
  }

  const drag: RenderBenchmarkResult[] = [];
  for (let rep = 1; rep <= REPETISI; rep += 1) {
    const rng = makeRng(SEED + 1);
    const sinkBox = { sink: 0 };
    const dragged = hitTestNearest(graph, 0, 0);
    const res = await runRenderBenchmark({
      label: `${prefix}-drag-r${rep}`,
      frames: FRAMES,
      renderFrame: () => dragFrame(graph, rng, dragged, sinkBox),
    });
    logResult('drag', rep, res);
    drag.push(res);
  }

  return { hover, drag };
};

const expectWaras = (res: RenderBenchmarkResult, frames: number): void => {
  expect(res.measureCount).toBe(frames);
  expect(res.frameTimesMs).toHaveLength(frames);
  for (const t of res.frameTimesMs) {
    expect(Number.isFinite(t)).toBe(true);
    expect(t).toBeGreaterThanOrEqual(0);
  }
  expect(res.frameTimesMs.reduce((a, b) => a + b, 0)).toBeGreaterThan(0);
  expect(res.avgFrameMs).not.toBeNull();
  expect(res.p95FrameMs).not.toBeNull();
  expect(res.p99FrameMs).not.toBeNull();
};

describe('v452 pointer interaction benchmark [perf]', () => {
  it(
    'hover dan drag 2000 node: ' +
      String(REPETISI) +
      ' repetisi x ' +
      String(FRAMES) +
      ' frame, statistik waras',
    async () => {
      const { hover, drag } = await runScenario(2000, 'v452-n2000');
      expect(hover).toHaveLength(REPETISI);
      expect(drag).toHaveLength(REPETISI);
      for (const r of hover) expectWaras(r, FRAMES);
      for (const r of drag) expectWaras(r, FRAMES);
    }
  );

  it(
    'hover dan drag 5000 node: ' +
      String(REPETISI) +
      ' repetisi x ' +
      String(FRAMES) +
      ' frame, statistik waras',
    async () => {
      const { hover, drag } = await runScenario(5000, 'v452-n5000');
      expect(hover).toHaveLength(REPETISI);
      expect(drag).toHaveLength(REPETISI);
      for (const r of hover) expectWaras(r, FRAMES);
      for (const r of drag) expectWaras(r, FRAMES);
    }
  );

  it('guard event: jalur sintetis dan native setara, coalesced guard aman', async () => {
    const graph = buildLargeGraph(15, 'v452-guard');
    const ev = createPointerEvent('pointermove', {
      pointerId: 7,
      pointerType: 'pen',
      isPrimary: false,
      clientX: 12,
      clientY: 34,
      buttons: 1,
    });
    expect(ev.pointerId).toBe(7);
    expect(ev.pointerType).toBe('pen');
    expect(ev.clientX).toBe(12);
    expect(ev.clientY).toBe(34);
    expect(ev.type).toBe('pointermove');
    // Guard limited availability: fungsi atau tidak ada, dua-duanya sah.
    const batch = coalescedOf(ev);
    expect(batch.length).toBeGreaterThanOrEqual(1);

    const rng = makeRng(SEED);
    const state = { hovered: -1, sink: 0 };
    const res = await runRenderBenchmark({
      label: 'v452-guard',
      frames: 5,
      renderFrame: () => hoverFrame(graph, rng, state),
    });
    expect(res.measureCount).toBe(5);
    expect(res.longTaskCount).toBe(0);
    expect(res.timestampSource).toBe('performance.now');
  });
});
