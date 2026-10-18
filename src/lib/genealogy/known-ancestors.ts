/**
 * Pure known-ancestors distribution module untuk GOAL v296.
 *
 * Tanpa import apa pun kecuali tipe dari family-graph (yang juga
 * pure). Metrik: computeKnownAncestorsDistribution menghitung
 * distribusi leluhur known per generasi dari satu root. Tiap
 * generasi g memiliki total slot 2^g dan known adalah leluhur
 * unik tercapai pada generasi itu. Jangkar tab Tree health README
 * MagicSunday/webtrees-statistics (riset 079, terverifikasi 18 Okt).
 *
 * Traversal BFS dari rootId melalui ParentEdge (anak ke ortu)
 * dengan visited set GLOBAL first-touch, pola v292/v294: leluhur
 * sama tercapai lewat beberapa jalur (pedigree collapse) dihitung
 * SEKALI pada generasi jarak BFS terpendek. Ortu unknown di luar
 * personIds tetap mengonsumsi slot (total 2^g) namun tidak
 * diperluas, sehingga slot tetap terhitung walau orangnya nihil
 * (tetap dihitung known karena tercapai lewat edge, tanpa edge
 * lanjutan untuk diperluas). Generasi yang frontier-nya kosong
 * tidak masuk output dan traversal berhenti; begitu satu generasi
 * nihil, generasi sesudahnya pasti nihil juga pada BFS first-touch.
 *
 * Fraction = known dibagi total slot, 4 desimal [inferensi,
 * warisan draft Sena]. rootId wajib terdaftar di personIds,
 * error VALIDATION bila nihil. maxGenerations default 8, rentang
 * 1 sampai 20, di luar rentang error VALIDATION (warisan v293).
 */

import type { FamilyGraph } from './family-graph';

export interface KnownAncestorGeneration {
  /** Nomor generasi, mulai 1 (ortu root). */
  generation: number;
  /** Leluhur unik tercapai pada generasi ini (visited global). */
  known: number;
  /** Total slot generasi ini, 2^generation. */
  total: number;
  /** known dibagi total, 4 desimal. */
  fraction: number;
}

export interface KnownAncestorsDistribution {
  rootId: string;
  maxGenerations: number;
  generations: KnownAncestorGeneration[];
  totalKnown: number;
}

const DEFAULT_MAX_GENERATIONS = 8;
const MIN_MAX_GENERATIONS = 1;
const MAX_MAX_GENERATIONS = 20;

function round4(value: number): number {
  return Math.round(value * 10000) / 10000;
}

/**
 * Distribusi leluhur known per generasi dari rootId. Hasil
 * deterministik: BFS memakai antrean FIFO dan anak-anak diproses
 * mengikuti urutan ParentEdge di graph, sehingga dua pemanggilan
 * pada graph sama menghasilkan struktur sama persis.
 */
export function computeKnownAncestorsDistribution(
  graph: FamilyGraph,
  rootId: string,
  maxGenerations: number = DEFAULT_MAX_GENERATIONS,
): KnownAncestorsDistribution {
  if (!Number.isInteger(maxGenerations) || maxGenerations < MIN_MAX_GENERATIONS || maxGenerations > MAX_MAX_GENERATIONS) {
    throw new Error(
      `maxGenerations VALIDATION: harus integer antara ${MIN_MAX_GENERATIONS} dan ${MAX_MAX_GENERATIONS}, dapat ${maxGenerations}`,
    );
  }
  if (!graph.personIds.includes(rootId)) {
    throw new Error(`rootId VALIDATION: ${rootId} tidak ada di personIds`);
  }

  // Peta anak ke ortu, urutan mengikuti ParentEdge di graph agar
  // deterministik terhadap urutan input.
  const parentsOf = new Map<string, string[]>();
  for (const edge of graph.parentEdges) {
    const existing = parentsOf.get(edge.child) ?? [];
    for (const parent of edge.parents) {
      existing.push(parent);
    }
    parentsOf.set(edge.child, existing);
  }

  const generations: KnownAncestorGeneration[] = [];
  const visited = new Set<string>([rootId]);
  let frontier: string[] = [rootId];
  let totalKnown = 0;

  for (let generation = 1; generation <= maxGenerations; generation += 1) {
    const nextFrontier: string[] = [];
    for (const person of frontier) {
      for (const parent of parentsOf.get(person) ?? []) {
        if (!visited.has(parent)) {
          visited.add(parent);
          nextFrontier.push(parent);
        }
      }
    }

    if (nextFrontier.length === 0) {
      break;
    }

    const known = nextFrontier.length;
    const total = 2 ** generation;
    totalKnown += known;
    generations.push({
      generation,
      known,
      total,
      fraction: round4(known / total),
    });
    frontier = nextFrontier;
  }

  return { rootId, maxGenerations, generations, totalKnown };
}
