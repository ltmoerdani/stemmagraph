/**
 * Pure tree-health module untuk GOAL v292 fase i.
 *
 * Tanpa import apa pun kecuali tipe dari family-graph (yang juga
 * pure). Metrik:
 * 1. computeGenerationDepth: kedalaman generasi leluhur (ancestral)
 *    dan keturunan (descendant) dari root, BFS dua arah lewat edge
 *    ortu-anak, guard visited set (preseden findloop Gramps).
 * 2. computePedigreeCompleteness: kelengkapan pedigree per
 *    generasi. total generasi g adalah 2^g (slot teoretis), known
 *    = jumlah leluhur berdarah unik yang terisi di generasi itu
 *    (pedi adopted/foster tidak diikuti), fraction = known/total.
 *
 * Jangkar istilah (addendum kontrak v292): "pedigree completeness"
 * terverifikasi sebagai nama metrik tab Tree health di README
 * MagicSunday/webtrees-statistics. Istilah "complete individual"
 * TIDAK diklaim sebagai istilah standar; definisi di sini eksplisit
 * internal: individu dengan slot leluhur terisi pada generasi
 * terkait. Formula rasio 0 sampai 1 konsisten konvensi literatur
 * Pedigree Completeness Index (preseden metodologis, addendum 6),
 * formula eksak adalah definisi internal [inferensi].
 * Jangkar GEDCOM 7: gedcom.io/terms/v7/INDI-NAME.
 */

import type { FamilyGraph, ParentEdge } from './family-graph';

export interface GenerationDepthResult {
  ancestral: number;
  descendant: number;
}

export interface PedigreeCompletenessRow {
  generation: number;
  known: number;
  total: number;
  fraction: number;
}

const BLOOD_PEDI = 'birth';

function isBloodEdge(edge: ParentEdge): boolean {
  return edge.pedi === undefined || edge.pedi === BLOOD_PEDI;
}

function parentsByChild(graph: FamilyGraph, bloodOnly: boolean): Map<string, string[]> {
  const map = new Map<string, string[]>();
  for (const edge of graph.parentEdges) {
    if (bloodOnly && !isBloodEdge(edge)) {
      continue;
    }
    const list = map.get(edge.child) ?? [];
    list.push(...edge.parents);
    map.set(edge.child, list);
  }
  return map;
}

function childrenByParent(graph: FamilyGraph): Map<string, string[]> {
  const map = new Map<string, string[]>();
  for (const edge of graph.parentEdges) {
    for (const parent of edge.parents) {
      const list = map.get(parent) ?? [];
      list.push(edge.child);
      map.set(parent, list);
    }
  }
  return map;
}

/**
 * Kedalaman generasi dua arah dari root. Node tunggal menghasilkan
 * { ancestral: 0, descendant: 0 }. Siklus A-B-A berhenti lewat
 * visited set tanpa hangus. Depth bersifat struktural: seluruh
 * edge ortu-anak dihitung, termasuk adopsi; pemisahan darah hanya
 * berlaku untuk computePedigreeCompleteness.
 */
export function computeGenerationDepth(
  graph: FamilyGraph,
  rootId: string,
): GenerationDepthResult {
  const up = parentsByChild(graph, false);
  const down = childrenByParent(graph);

  const measure = (adjacency: Map<string, string[]>): number => {
    const seen = new Set<string>([rootId]);
    let frontier: string[] = [rootId];
    let depth = 0;
    while (frontier.length > 0) {
      const next: string[] = [];
      for (const id of frontier) {
        for (const neighbor of adjacency.get(id) ?? []) {
          if (!seen.has(neighbor)) {
            seen.add(neighbor);
            next.push(neighbor);
          }
        }
      }
      if (next.length > 0) {
        depth += 1;
      }
      frontier = next;
    }
    return depth;
  };

  return { ancestral: measure(up), descendant: measure(down) };
}

/**
 * Kelengkapan pedigree per generasi, generasi 1 = orang tua.
 * total = 2^generation. known = jumlah individu unik yang dicapai
 * root dengan tepat `generation` langkah ke atas lewat edge darah
 * (pedi undefined atau birth). Pedigree collapse membuat satu
 * individu mengisi lebih dari satu slot, sehingga known dihitung
 * per individu unik, bukan per slot terisi (kasus 13 kontrak:
 * anak dua sepupu pertama, generasi 3 known 6 dari total 8).
 * Frontier TIDAK memakai visited lintas generasi karena individu
 * boleh muncul di beberapa generasi (DAG collapse); batas atas
 * maxGenerations menjaga traversal tetap berhenti.
 * maxGenerations 0 menghasilkan array kosong.
 */
export function computePedigreeCompleteness(
  graph: FamilyGraph,
  rootId: string,
  maxGenerations: number,
): PedigreeCompletenessRow[] {
  const up = parentsByChild(graph, true);
  const rows: PedigreeCompletenessRow[] = [];
  let frontier = new Set<string>([rootId]);
  for (let generation = 1; generation <= maxGenerations; generation += 1) {
    const next = new Set<string>();
    for (const id of frontier) {
      for (const parent of up.get(id) ?? []) {
        next.add(parent);
      }
    }
    const known = next.size;
    const total = 2 ** generation;
    rows.push({ generation, known, total, fraction: known / total });
    frontier = next;
  }
  return rows;
}
