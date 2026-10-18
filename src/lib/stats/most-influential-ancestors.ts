import type { FamilyGraph } from '../genealogy/family-graph';

export interface InfluentialAncestor {
  personId: string;
  descendantCount: number;
}

const DEFAULT_TOP_N = 10;

/**
 * Peringkat leluhur paling berpengaruh berdasarkan jumlah keturunan
 * transitif. Kandidat adalah setiap orang yang tercatat sebagai orang
 * tua pada minimal satu parentEdge. Traversal BFS menurun memakai
 * visited set global first-touch, sehingga orang yang terjangkau lewat
 * beberapa jalur (pedigree collapse) tetap terhitung sekali per orang.
 *
 * Hasil diurutkan descendantCount menurun, tie-break personId naik.
 * Orang tanpa keturunan tidak ikut hasil. Panggilan dengan topN <= 0
 * mengembalikan array kosong. Fungsi pure dan deterministik.
 */
export function mostInfluentialAncestors(
  graph: FamilyGraph,
  topN: number = DEFAULT_TOP_N,
): InfluentialAncestor[] {
  if (topN <= 0) {
    return [];
  }

  const childrenByParent = new Map<string, string[]>();
  const candidates = new Set<string>();

  for (const edge of graph.parentEdges) {
    for (const parent of edge.parents) {
      candidates.add(parent);
      const children = childrenByParent.get(parent);
      if (children) {
        children.push(edge.child);
      } else {
        childrenByParent.set(parent, [edge.child]);
      }
    }
  }

  const ranked: InfluentialAncestor[] = [];

  for (const personId of candidates) {
    // Kandidat sendiri ditandai visited sejak awal agar jalur balik
    // tidak membuat orang menghitung dirinya sebagai keturunan.
    const visited = new Set<string>([personId]);
    const queue: string[] = [personId];
    let head = 0;
    let count = 0;

    while (head < queue.length) {
      const current = queue[head];
      head += 1;
      const children = childrenByParent.get(current);
      if (!children) {
        continue;
      }
      for (const child of children) {
        if (visited.has(child)) {
          continue;
        }
        visited.add(child);
        count += 1;
        queue.push(child);
      }
    }

    if (count > 0) {
      ranked.push({ personId, descendantCount: count });
    }
  }

  ranked.sort((a, b) => {
    if (b.descendantCount !== a.descendantCount) {
      return b.descendantCount - a.descendantCount;
    }
    if (a.personId < b.personId) {
      return -1;
    }
    if (a.personId > b.personId) {
      return 1;
    }
    return 0;
  });

  return ranked.slice(0, topN);
}
