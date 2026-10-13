/**
 * Fixture graf perf v177-i fase prep (test-only).
 *
 * Builder node dan edge pure: tidak menyentuh state, tidak mengimpor
 * berkas produksi selain type. Struktur node mengikuti tipe yang
 * dikonsumsi ReactFlowFamilyTree (FamilyMemberFlowNode dengan data
 * FamilyMemberNodeData berisi member FamilyMember).
 */
import type { Edge } from '@xyflow/react';
import type { FamilyMember } from '../../../types/family';
import type { FamilyMemberFlowNode } from '../nodes/FamilyMemberNode';

/** Member minimal valid sesuai interface FamilyMember. */
export const buildPerfMember = (
  id: string,
  generation: number,
  parentIds: string[] = []
): FamilyMember => ({
  id,
  name: `Perf Member ${id}`,
  birthDate: '1990-01-01',
  gender: 'male',
  isAlive: true,
  generation,
  maritalStatus: 'single',
  parentIds: parentIds.length > 0 ? parentIds : undefined,
});

/** Node FamilyMemberFlowNode dengan handler no-op sesuai kontrak data. */
export const buildPerfNode = (
  id: string,
  generation: number,
  parentIds: string[] = []
): FamilyMemberFlowNode => ({
  id,
  type: 'familyMember',
  position: { x: 0, y: generation * 160 },
  data: {
    member: buildPerfMember(id, generation, parentIds),
    onEdit: () => undefined,
    onAddChild: () => undefined,
    onAddSpouse: () => undefined,
    tier: generation,
  },
});

/** Edge tanpa tipe kustom: cukup id, source, target untuk kebutuhan hitung. */
export const buildPerfEdge = (id: string, source: string, target: string): Edge => ({
  id,
  source,
  target,
});

export interface PerfGraph {
  nodes: FamilyMemberFlowNode[];
  edges: Edge[];
}

/**
 * HARNESS_ALIASES: line graph 6 generasi, kontrak v177-i 15 node 14 edges.
 * Komposisi generasi: 1 / 2 / 2 / 2 / 4 / 4, tiap node non-root punya
 * tepat satu parent sehingga edges = nodes - 1 = 14.
 */
export const buildHarnessAliases = (): PerfGraph => {
  const specs: Array<[string, number, string | null]> = [
    ['ali-root', 0, null],
    ['ali-g1a', 1, 'ali-root'],
    ['ali-g1b', 1, 'ali-root'],
    ['ali-g2a', 2, 'ali-g1a'],
    ['ali-g2b', 2, 'ali-g1b'],
    ['ali-g3a', 3, 'ali-g2a'],
    ['ali-g3b', 3, 'ali-g2b'],
    ['ali-g4a', 4, 'ali-g3a'],
    ['ali-g4b', 4, 'ali-g3a'],
    ['ali-g4c', 4, 'ali-g3b'],
    ['ali-g4d', 4, 'ali-g3b'],
    ['ali-g5a', 5, 'ali-g4a'],
    ['ali-g5b', 5, 'ali-g4b'],
    ['ali-g5c', 5, 'ali-g4c'],
    ['ali-g5d', 5, 'ali-g4d'],
  ];
  const nodes = specs.map(([id, generation, parent]) =>
    buildPerfNode(id, generation, parent ? [parent] : [])
  );
  const edges = specs
    .filter((spec): spec is [string, number, string] => spec[2] !== null)
    .map(([id, , parent], i) => buildPerfEdge(`ali-e${i}`, parent, id));
  return { nodes, edges };
};

/**
 * HARNESS_BINARY: binary tree kedalaman 7 (root level 0 sampai level 7),
 * 255 node 254 edges. Anak node i adalah 2i+1 dan 2i+2.
 */
export const buildHarnessBinary = (): PerfGraph => {
  const nodes: FamilyMemberFlowNode[] = [];
  const edges: Edge[] = [];
  for (let i = 0; i < 255; i += 1) {
    const parent = i === 0 ? null : Math.floor((i - 1) / 2);
    nodes.push(
      buildPerfNode(`bin-${i}`, i === 0 ? 0 : Math.floor(Math.log2(i + 1)), parent === null ? [] : [`bin-${parent}`])
    );
    if (parent !== null) {
      edges.push(buildPerfEdge(`bin-e${i}`, `bin-${parent}`, `bin-${i}`));
    }
  }
  return { nodes, edges };
};

/** HARNESS_WIDE: root + 240 anak, 241 node 240 edges. */
export const buildHarnessWide = (): PerfGraph => {
  const nodes: FamilyMemberFlowNode[] = [buildPerfNode('wide-root', 0)];
  const edges: Edge[] = [];
  for (let i = 0; i < 240; i += 1) {
    const id = `wide-c${i}`;
    nodes.push(buildPerfNode(id, 1, ['wide-root']));
    edges.push(buildPerfEdge(`wide-e${i}`, 'wide-root', id));
  }
  return { nodes, edges };
};
