/**
 * Auto poster layout builder (S-10).
 *
 * Product decision note (Q4-a vs Q4-b): this builder derives poster node
 * positions AUTOMATICALLY from family data, ordered by a breadth-first
 * family walk so relatives stay grouped. A future interactive poster editor
 * (Q4-b) would replace this builder; the renderer contract stays the same.
 *
 * Layout vocabulary (arbitrary units, Y grows downward):
 * - one row per generation
 * - children of the same parent share one horizontal connector rail
 */

import type { FamilyMember } from '../../types/family';
import type {
  PosterConnector,
  PosterIndividual,
  PosterNodePosition,
  PosterPaper,
  PosterSpec,
} from './types';

/** Node box size in layout units. */
const NODE_W = 170;
const NODE_H = 60;
/** Horizontal gap between sibling boxes. */
const GAP_X = 26;
/** Row pitch: node height plus the connector drop zone. */
const ROW_H = 130;
/** Rail position inside the drop zone, measured from the parent bottom. */
const RAIL_DROP = 30;

export interface BuildPosterSpecInput {
  members: FamilyMember[];
  paper: PosterPaper;
  /** Poster title, usually the family tree name. Optional. */
  title?: string;
}

/**
 * Orders members with a family-first BFS: roots first (earliest generation,
 * no in-tree parents), then each parent followed by its children. Members
 * unreachable through the walk still render, appended per generation.
 */
function orderMembers(members: FamilyMember[]): FamilyMember[] {
  const byId = new Map(members.map((m) => [m.id, m]));
  const minGen = Math.min(...members.map((m) => m.generation));
  const hasTreeParent = (m: FamilyMember) =>
    (m.parentIds ?? []).some((pid) => byId.has(pid));

  const roots = members
    .filter((m) => m.generation === minGen || !hasTreeParent(m))
    .sort((a, b) => a.generation - b.generation || a.name.localeCompare(b.name));

  const ordered: FamilyMember[] = [];
  const visited = new Set<string>();
  const queue: FamilyMember[] = [...roots];
  while (queue.length > 0) {
    const current = queue.shift() as FamilyMember;
    if (visited.has(current.id)) continue;
    visited.add(current.id);
    ordered.push(current);
    for (const childId of current.childrenIds ?? []) {
      const child = byId.get(childId);
      if (child && !visited.has(childId)) queue.push(child);
    }
  }
  // Orphans (broken links) still deserve a place on the poster.
  for (const m of members) {
    if (!visited.has(m.id)) ordered.push(m);
  }
  return ordered;
}

/**
 * Builds a complete poster spec from family data: individuals, auto layout
 * positions, and parent-to-child orthogonal connectors.
 */
export function buildPosterSpec(input: BuildPosterSpecInput): PosterSpec {
  const { members, paper, title } = input;
  if (members.length === 0) {
    throw new Error('Cannot build a poster from an empty family');
  }

  const ordered = orderMembers(members);
  const minGen = Math.min(...members.map((m) => m.generation));

  // Assign X by walking rows: each node takes the next free slot.
  const rowCursorX = new Map<number, number>();
  const positions: Record<string, PosterNodePosition> = {};
  const individuals: PosterIndividual[] = [];
  for (const m of ordered) {
    const row = m.generation - minGen;
    const x = rowCursorX.get(row) ?? 0;
    positions[m.id] = { x, y: row * ROW_H, width: NODE_W, height: NODE_H };
    rowCursorX.set(row, x + NODE_W + GAP_X);
    individuals.push({ id: m.id, name: m.name, generation: m.generation });
  }

  const byId = new Map(members.map((m) => [m.id, m]));
  const connectors: PosterConnector[] = [];
  for (const parent of members) {
    for (const childId of parent.childrenIds ?? []) {
      if (!byId.has(childId)) continue;
      connectors.push({
        parentId: parent.id,
        childId,
        railY: (parent.generation - minGen) * ROW_H + NODE_H + RAIL_DROP,
      });
    }
  }

  return {
    individuals,
    positions,
    connectors,
    title: title && title.trim() !== '' ? title : undefined,
    paper,
  };
}
