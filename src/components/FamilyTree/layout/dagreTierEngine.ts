import { Position, type Edge } from '@xyflow/react';
import dagre from 'dagre';
import type { FamilyMemberFlowNode } from '../nodes/FamilyMemberNode';
import { calculateTierLayout, type TierLayout } from './tierLayout';
import type {
  LayoutDirection,
  LayoutEngine,
  LayoutEngineOptions,
  LayoutResult,
  LayoutSnapGrid,
} from './types';

/**
 * DagreTierEngine (S-09 AC1).
 *
 * Isi file ini adalah PINDAHAN logika layout dari ReactFlowFamilyTree.tsx
 * (algoritma dagre + konfigurasi snap grid generasi) dan bukan tulis-ulang:
 * konstanta, angka spacing, dan urutan langkah dipertahankan apa adanya
 * supaya hasil render identik dengan sebelum abstraksi.
 */

// Dagre layout configuration (dipindah dari ReactFlowFamilyTree.tsx)
const dagreGraph = new dagre.graphlib.Graph();
dagreGraph.setDefaultEdgeLabel(() => ({}));

const nodeWidth = 200;
const nodeHeight = 140; // Increased for better bracket spacing

/**
 * Snap grid generasi: TB rata pada grid agar kartu sejajar baris generasi,
 * LR bebas. Dipindah dari prop ReactFlow di ReactFlowFamilyTree.tsx.
 */
const getSnapGrid = (direction: LayoutDirection): LayoutSnapGrid =>
  direction === 'TB' ? { snapToGrid: true, snapGrid: [25, 50] } : { snapToGrid: false, snapGrid: [25, 50] };

/**
 * Converts family members to React Flow nodes with proper positioning
 * (dipindah apa adanya dari ReactFlowFamilyTree.tsx).
 */
const getLayoutedElements = (
  nodes: FamilyMemberFlowNode[],
  edges: Edge[],
  direction = 'TB'
): { nodes: FamilyMemberFlowNode[]; edges: Edge[] } => {
  const isHorizontal = direction === 'LR';

  // Configure dagre for bracket-style layout with professional spacing
  dagreGraph.setGraph({
    rankdir: direction,
    nodesep: 150, // Enhanced professional spacing between nodes
    ranksep: 280, // Optimal spacing between generations for brackets
    marginx: 80,
    marginy: 80,
  });

  nodes.forEach((node) => {
    dagreGraph.setNode(node.id, { width: nodeWidth, height: nodeHeight });
  });

  edges.forEach((edge) => {
    dagreGraph.setEdge(edge.source, edge.target);
  });

  dagre.layout(dagreGraph);

  const layoutedNodes = nodes.map((node) => {
    const nodeWithPosition = dagreGraph.node(node.id);
    const newNode = {
      ...node,
      targetPosition: isHorizontal ? Position.Left : Position.Top,
      sourcePosition: isHorizontal ? Position.Right : Position.Bottom,
      position: {
        x: nodeWithPosition.x - nodeWidth / 2,
        y: nodeWithPosition.y - nodeHeight / 2,
      },
    };

    return newNode;
  });

  return { nodes: layoutedNodes, edges };
};

/**
 * Converts family members to React Flow nodes with tier-based positioning
 * (dipindah apa adanya dari ReactFlowFamilyTree.tsx; isi fungsi tetap di
 * layout/tierLayout.ts hasil pemindahan dari utils/tierLayoutManager.ts).
 */
const getTierLayoutedElements = (
  nodes: FamilyMemberFlowNode[]
): { nodes: FamilyMemberFlowNode[]; edges: Edge[]; tiers: TierLayout[] } => {
  const { layoutedNodes, tiers } = calculateTierLayout(nodes);
  return { nodes: layoutedNodes, edges: [], tiers };
};

const nowMs = (): number =>
  typeof performance !== 'undefined' && typeof performance.now === 'function'
    ? performance.now()
    : Date.now();

/**
 * Engine gabungan: TB memakai tier layout generasi, LR memakai dagre.
 * Satu-satunya tempat di aplikasi yang boleh mengimpor dagre.
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
      const tiered = getTierLayoutedElements(nodes);
      layoutedNodes = tiered.nodes;
      layoutedEdges = tiered.edges;
      tiers = tiered.tiers;
    } else {
      const dagred = getLayoutedElements(nodes, edges, direction);
      layoutedNodes = dagred.nodes;
      layoutedEdges = dagred.edges;
      tiers = [];
    }

    const positions = new Map<string, { x: number; y: number }>(
      layoutedNodes.map((node) => [node.id, { x: node.position.x, y: node.position.y }])
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

export { getSnapGrid };
