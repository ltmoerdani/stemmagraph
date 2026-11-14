/**
 * v458 fase 1: inti murni perhitungan posisi dagre (arah LR).
 *
 * Modul ini hanya mengimpor dagre dan data plain, tanpa tipe React Flow,
 * supaya bisa dijalankan identik di main thread dan di Web Worker.
 * Konstanta spacing dipertahankan dari getLayoutedElements lama di
 * dagreTierEngine.ts agar hasil layout identik (refactor non-regresi).
 *
 * Perbedaan implementasi terhadap kode lama: graph dibuat segar per
 * panggilan (bukan modul global reuse) supaya stateless dan aman
 * terhadap pesan worker yang datang berurutan. Dagre deterministik
 * untuk graph dan konfigurasi sama, hasil posisi tidak berubah.
 */
import dagre from 'dagre';

export interface DagrePlanNodeInput {
  id: string;
}

export interface DagrePlanEdgeInput {
  source: string;
  target: string;
}

export interface DagrePlanPosition {
  x: number;
  y: number;
}

export interface DagrePlanResult {
  positions: Record<string, DagrePlanPosition>;
}

// Konstanta dipindah apa adanya dari dagreTierEngine.ts lama.
const NODE_WIDTH = 200;
const NODE_HEIGHT = 140;

export type DagrePlanDirection = 'LR';

/**
 * Inti murni dagre: posisi terpusat per node id dari input minimal.
 * Dipakai jalur LR; jalur TB memakai tierPlan.ts.
 */
export const computeDagrePlan = (
  nodes: DagrePlanNodeInput[],
  edges: DagrePlanEdgeInput[],
  direction: DagrePlanDirection = 'LR'
): DagrePlanResult => {
  const graph = new dagre.graphlib.Graph();
  graph.setDefaultEdgeLabel(() => ({}));
  graph.setGraph({
    rankdir: direction,
    nodesep: 150,
    ranksep: 280,
    marginx: 80,
    marginy: 80,
  });

  nodes.forEach((node) => {
    graph.setNode(node.id, { width: NODE_WIDTH, height: NODE_HEIGHT });
  });
  edges.forEach((edge) => {
    graph.setEdge(edge.source, edge.target);
  });

  dagre.layout(graph);

  const positions: Record<string, DagrePlanPosition> = {};
  nodes.forEach((node) => {
    const placed = graph.node(node.id);
    positions[node.id] = {
      x: placed.x - NODE_WIDTH / 2,
      y: placed.y - NODE_HEIGHT / 2,
    };
  });

  return { positions };
};
