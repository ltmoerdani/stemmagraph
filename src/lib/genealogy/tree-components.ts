/**
 * Pure connected-components module untuk GOAL v294 fase i.
 *
 * Tanpa import apa pun kecuali tipe dari family-graph (yang juga
 * pure). Komponen dihitung atas graf relasi FAM saja: node adalah
 * personIds, sisi dibaca dari dua sumber FamilyGraph: ParentEdge
 * (FAMC, child ke tiap orang tua, dua arah) dan UnionNode.spouses
 * (FAMS, pasangan dalam satu FAM disatukan berantai). Putusan PM
 * salvase 18 Okt: kontrak v294 menyebut relasi pasangan, anak
 * FAMC, ortu FAMS, semantik GEDCOM FAM menyatukan HUSB WIFE CHIL
 * dalam satu record, sehingga pasangan tanpa anak tetap satu
 * komponen. Individu tanpa edge membentuk komponen sendirian
 * size 1.
 *
 * Traversal BFS dengan visited set (pola v292 tree-health.ts,
 * preseden findloop Gramps) sehingga siklus A-B-A berhenti tanpa
 * hangus dan DAG leluhur duplikat tetap terhitung sekali.
 * Jangkar istilah: tab Tree health pada README
 * MagicSunday/webtrees-statistics.
 */

import type { FamilyGraph } from './family-graph';

export interface TreeComponent {
  /** Anggota komponen, urutan penemuan BFS dari seed personIds. */
  members: string[];
  size: number;
}

export interface ConnectedComponentsResult {
  components: TreeComponent[];
  componentCount: number;
  largestSize: number;
  largestFraction: number;
}

/**
 * Adjacency tak berarah dari ParentEdge dan UnionNode.spouses.
 * Sisi parent dibangun dua arah (child ke parent, parent ke
 * child); sisi pasangan dibangun berantai spouses[i] ke spouses[j]
 * untuk tiap pasangan berurutan dalam satu FAM; unions tanpa dua
 * pasangan tidak menghasilkan sisi dari union itu sendiri.
 */
function adjacencyFromParentEdges(graph: FamilyGraph): Map<string, string[]> {
  const map = new Map<string, string[]>();
  for (const edge of graph.parentEdges) {
    for (const parent of edge.parents) {
      const fromChild = map.get(edge.child) ?? [];
      fromChild.push(parent);
      map.set(edge.child, fromChild);
      const fromParent = map.get(parent) ?? [];
      fromParent.push(edge.child);
      map.set(parent, fromParent);
    }
  }
  for (const node of graph.unions) {
    for (let i = 1; i < node.spouses.length; i += 1) {
      const prev = node.spouses[i - 1];
      const curr = node.spouses[i];
      if (!prev || !curr) {
        continue;
      }
      const toCurr = map.get(prev) ?? [];
      toCurr.push(curr);
      map.set(prev, toCurr);
      const toPrev = map.get(curr) ?? [];
      toPrev.push(prev);
      map.set(curr, toPrev);
    }
  }
  return map;
}

/**
 * Komponen terhubung atas graf relasi FAM. Seed berjalan pada
 * personIds urutan masuk sehingga hasil deterministik terhadap
 * urutan deklarasi. Urutan komponen: size desc, tie-break anggota
 * pertama (urutan personIds) asc. largestSize 0 dan
 * largestFraction 0 pada graph kosong; largestFraction adalah
 * largestSize dibagi total individu.
 */
export function computeConnectedComponents(
  graph: FamilyGraph,
): ConnectedComponentsResult {
  const adjacency = adjacencyFromParentEdges(graph);
  const visited = new Set<string>();
  const components: TreeComponent[] = [];

  for (const seed of graph.personIds) {
    if (visited.has(seed)) {
      continue;
    }
    visited.add(seed);
    const members: string[] = [seed];
    let frontier: string[] = [seed];
    while (frontier.length > 0) {
      const next: string[] = [];
      for (const id of frontier) {
        for (const neighbor of adjacency.get(id) ?? []) {
          if (!visited.has(neighbor)) {
            visited.add(neighbor);
            members.push(neighbor);
            next.push(neighbor);
          }
        }
      }
      frontier = next;
    }
    components.push({ members, size: members.length });
  }

  components.sort((a, b) => {
    if (b.size !== a.size) {
      return b.size - a.size;
    }
    const firstA = a.members[0] ?? '';
    const firstB = b.members[0] ?? '';
    if (firstA < firstB) {
      return -1;
    }
    return firstA > firstB ? 1 : 0;
  });

  const total = graph.personIds.length;
  const largestSize = components.length > 0 ? components[0].size : 0;
  const largestFraction = total > 0 ? largestSize / total : 0;

  return {
    components,
    componentCount: components.length,
    largestSize,
    largestFraction,
  };
}
