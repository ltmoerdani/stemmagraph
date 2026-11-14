/**
 * DagreTierEngine (S-09 AC1, refactor v458 fase 1).
 *
 * Isi asli file ini adalah PINDAHAN logika layout dari
 * ReactFlowFamilyTree.tsx. v458 fase 1 memindahkan inti perhitungan ke
 * modul murni (tierPlan.ts dan dagrePlan.ts) yang dipakai bersama jalur
 * Web Worker (layoutService.ts). Konstanta, angka spacing, dan urutan
 * langkah dipertahankan apa adanya supaya hasil render identik dengan
 * sebelum refactor.
 *
 * Engine ini tetap sinkron (kontrak LayoutEngine, dipakai test dan
 * pemanggil non-komponen); komponen memakai jalur async computeLayoutAsync
 * (layoutApply.ts) yang menjalankan compute yang sama via worker.
 */
import { Position, type Edge } from '@xyflow/react';
import type { FamilyMemberFlowNode } from '../nodes/FamilyMemberNode';
import { computeDagrePlan } from './dagrePlan';
import { calculateTierLayout, type TierLayout } from './tierLayout';
import type {
  LayoutDirection,
  LayoutEngine,
  LayoutEngineOptions,
  LayoutResult,
  LayoutSnapGrid,
} from './types';

/**
 * Snap grid generasi: TB rata pada grid agar kartu sejajar baris generasi,
 * LR bebas. Dipertahankan dari kontrak lama.
 */
export const getSnapGrid = (direction: LayoutDirection): LayoutSnapGrid =>
  direction === 'TB'
    ? { snapToGrid: true, snapGrid: [25, 50] }
    : { snapToGrid: false, snapGrid: [25, 50] };

/**
 * Layout dagre murni (LR): posisi terpusat dan arah handle kiri/kanan.
 * Dipindah apa adanya dari getLayoutedElements lama; inti compute ada
 * di dagrePlan.ts (modul murni worker-safe).
 */
const getLayoutedElements = (
  nodes: FamilyMemberFlowNode[],
  edges: Edge[]
): { nodes: FamilyMemberFlowNode[]; edges: Edge[] } => {
  const plan = computeDagrePlan(
    nodes.map((node) => ({ id: node.id })),
    edges.map((edge) => ({ source: edge.source, target: edge.target })),
    'LR'
  );

  const layoutedNodes = nodes.map((node) => {
    const placed = plan.positions[node.id];
    return {
      ...node,
      targetPosition: Position.Left,
      sourcePosition: Position.Right,
      position: placed ? { x: placed.x, y: placed.y } : node.position,
    };
  });

  return { nodes: layoutedNodes, edges };
};

const nowMs = (): number =>
  typeof performance !== 'undefined' && typeof performance.now === 'function'
    ? performance.now()
    : Date.now();

/**
 * Engine gabungan: TB memakai tier layout generasi, LR memakai dagre.
 */
export class DagreTierEngine implements LayoutEngine {
  readonly name = 'dagre-tier';

  layout(
    nodes: FamilyMemberFlowNode[],
    edges: Edge[],
    options?: LayoutEngineOptions
  ): LayoutResult {
    const direction: LayoutDirection = options?.direction ?? 'TB';
    const startedAt = nowMs();

    let layoutedNodes: FamilyMemberFlowNode[];
    let layoutedEdges: Edge[];
    let tiers: TierLayout[];
    if (direction === 'TB') {
      const tiered = calculateTierLayout(nodes);
      layoutedNodes = tiered.layoutedNodes;
      layoutedEdges = edges;
      tiers = tiered.tiers;
    } else {
      const dagred = getLayoutedElements(nodes, edges);
      layoutedNodes = dagred.nodes;
      layoutedEdges = dagred.edges;
      tiers = [];
    }

    const positions = new Map(
      layoutedNodes.map((node) => [
        node.id,
        { x: node.position.x, y: node.position.y },
      ])
    );

    return {
      nodes: layoutedNodes,
      edges: layoutedEdges,
      tiers,
      positions,
      snap: getSnapGrid(direction),
      meta: {
        engine: this.name,
        direction,
        nodeCount: nodes.length,
        edgeCount: edges.length,
        tierCount: tiers.length,
        computeMs: nowMs() - startedAt,
      },
    };
  }
}

/** Instance tunggal, dipakai komponen via interface LayoutEngine. */
export const dagreTierEngine: LayoutEngine = new DagreTierEngine();
