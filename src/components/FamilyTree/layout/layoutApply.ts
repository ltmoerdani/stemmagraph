/**
 * v458 fase 1: menerapkan rencana layout (plain) ke node React Flow
 * penuh di main thread, dan orchestrator async untuk komponen.
 *
 * Pemisahan ini kunci arsitektur worker: payload yang dikirim ke worker
 * hanya field minimal (extractTierInput), hasil rencana diterima dan
 * di-apply ke objek node penuh di sini (apply). Callbacks di node.data
 * tidak pernah menyeberang ke worker, jadi bebas DataCloneError.
 */
import { Position, type Edge } from '@xyflow/react';
import type { FamilyMemberFlowNode } from '../nodes/FamilyMemberNode';
import type { FamilyMember } from '../../../types/family';
import { layoutService } from './layoutService';
import type { TierPlanMemberInput, TierPlanResult } from './tierPlan';
import type { DagrePlanDirection, DagrePlanResult } from './dagrePlan';
import type { LayoutDirection } from './types';
import type { TierLayout } from './tierLayout';

/**
 * Input minimal per node untuk tier plan. member dibaca defensif:
 * kode layout lama juga menangani member null/undefined secara runtime
 * (tierLayout lama: member?.generation ?? 0).
 */
export const extractTierInput = (
  nodes: FamilyMemberFlowNode[]
): TierPlanMemberInput[] =>
  nodes.map((node) => {
    const member = node.data.member as FamilyMember | undefined;
    return {
      id: node.id,
      name: member?.name ?? '',
      generation: member?.generation ?? 0,
      parentIds: member?.parentIds,
      spouseId: member?.spouseId,
    };
  });

/**
 * Terapkan rencana tier ke node penuh. Disiplin S-09 AC4 dipertahankan:
 * objek data lama dipakai ulang bila stamp tier tidak berubah supaya
 * referensi node stabil untuk bagian tak berubah (React.memo guard).
 */
export const applyTierPlan = (
  nodes: FamilyMemberFlowNode[],
  plan: TierPlanResult
): FamilyMemberFlowNode[] => {
  const tierIndexById = new Map<string, number>();
  plan.tiers.forEach((tier, index) => {
    tier.members.forEach((id) => {
      tierIndexById.set(id, index);
    });
  });

  return nodes.map((node) => {
    const position = plan.positions[node.id];
    if (!position) return node;
    const tierIndex = tierIndexById.get(node.id);
    const familyGroup = plan.familyGroups[node.id] ?? '';
    const dataUnchanged =
      node.data.tier === tierIndex &&
      node.data.generationY === position.y &&
      node.data.familyGroup === familyGroup;

    return {
      ...node,
      position: { x: position.x, y: position.y },
      data: dataUnchanged
        ? node.data
        : {
            ...node.data,
            tier: tierIndex,
            generationY: position.y,
            familyGroup,
          },
    };
  });
};

/** Terapkan rencana dagre (LR): posisi plus arah handle kiri/kanan. */
export const applyDagrePlan = (
  nodes: FamilyMemberFlowNode[],
  plan: DagrePlanResult
): FamilyMemberFlowNode[] =>
  nodes.map((node) => {
    const position = plan.positions[node.id];
    if (!position) return node;
    return {
      ...node,
      targetPosition: Position.Left,
      sourcePosition: Position.Right,
      position: { x: position.x, y: position.y },
    };
  });

/** Hasil layout async, bentuk dipertahankan dari kontrak LayoutEngine. */
export interface AsyncLayoutResult {
  nodes: FamilyMemberFlowNode[];
  /** Edge dikembalikan apa adanya, konsisten engine lama (semua arah). */
  edges: Edge[];
  tiers: TierLayout[];
  meta: {
    engine: string;
    direction: LayoutDirection;
    nodeCount: number;
    edgeCount: number;
    tierCount: number;
    /** Durasi wall-clock termasuk round-trip worker bila dipakai. */
    computeMs: number;
  };
}

const toEdgePairs = (edges: Edge[]): Array<{ source: string; target: string }> =>
  edges.map((edge) => ({ source: edge.source, target: edge.target }));

/**
 * Orchestrator async layout untuk komponen: tier (TB) atau dagre (LR)
 * via layoutService (worker + fallback), lalu apply di main thread.
 */
export const computeLayoutAsync = async (
  nodes: FamilyMemberFlowNode[],
  edges: Edge[],
  options?: { direction?: LayoutDirection }
): Promise<AsyncLayoutResult> => {
  const direction: LayoutDirection = options?.direction ?? 'TB';
  const startedAt = Date.now();

  let layoutedNodes: FamilyMemberFlowNode[];
  let tiers: TierLayout[];
  if (direction === 'TB') {
    const plan = await layoutService.computeTierLayout(extractTierInput(nodes));
    layoutedNodes = applyTierPlan(nodes, plan);
    tiers = plan.tiers;
  } else {
    const dir: DagrePlanDirection = 'LR';
    const plan = await layoutService.computeDagreLayout(
      nodes.map((node) => node.id),
      toEdgePairs(edges),
      dir
    );
    layoutedNodes = applyDagrePlan(nodes, plan);
    tiers = [];
  }

  return {
    nodes: layoutedNodes,
    edges,
    tiers,
    meta: {
      engine: 'dagre-tier-async',
      direction,
      nodeCount: nodes.length,
      edgeCount: edges.length,
      tierCount: tiers.length,
      computeMs: Date.now() - startedAt,
    },
  };
};
