import type { FamilyMemberFlowNode } from '../nodes/FamilyMemberNode';
import { computeTierPlan } from './tierPlan';
import { applyTierPlan, extractTierInput } from './layoutApply';

export interface TierLayout {
  generation: number;
  y: number;
  members: string[];
}

/**
 * Calculate tier-based layout for family tree.
 * Each generation has fixed Y position, nodes can only move horizontally.
 *
 * v458 fase 1: inti perhitungan dipindah ke tierPlan.computeTierPlan
 * (modul murni yang dipakai bersama jalur Web Worker), fungsi ini tinggal
 * adaptasi antara node React Flow penuh dan payload plain. Konstanta
 * spacing dan urutan sortir hidup di tierPlan.ts (satu sumber kebenaran).
 *
 * @param nodes - Array of family member nodes to layout
 * @returns Object containing layouted nodes and tier information
 */
export const calculateTierLayout = (
  nodes: FamilyMemberFlowNode[]
): { layoutedNodes: FamilyMemberFlowNode[]; tiers: TierLayout[] } => {
  const plan = computeTierPlan(extractTierInput(nodes));
  const layoutedNodes = applyTierPlan(nodes, plan);
  return { layoutedNodes, tiers: plan.tiers };
};

/**
 * Constrain node movement to horizontal only within its tier
 * @param nodeId - ID of the node being moved
 * @param newPosition - Attempted new position
 * @param tiers - Array of tier layout information
 * @returns Constrained position with fixed Y coordinate
 */
export const constrainNodeMovement = (
  nodeId: string,
  newPosition: { x: number; y: number },
  tiers: TierLayout[]
): { x: number; y: number } => {
  // Find which tier this node belongs to
  const tier = tiers.find(t => t.members.includes(nodeId));
  
  if (!tier) {
    return newPosition;
  }

  // Allow horizontal movement but fix Y position
  return {
    x: newPosition.x,
    y: tier.y
  };
};
