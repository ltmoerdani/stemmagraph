/**
 * Consanguinity (v326 fase i): modul PURE untuk statistik demografis
 * keluarga, pilar 2 VISION-stemmagraph. Jangkar riset: PLOS ONE Alvarez
 * & Ceballos 2009 (inbreeding dinasti Eropa) plus Wikipedia pedigree
 * collapse. Saudara divorce-widowhood.ts (v325) dan couple-age-gap.ts
 * (v318).
 *
 * METRIK: pasangan satu union yang berbagi leluhur (konsanguin).
 * Berbeda dari v296 known-ancestors yang mengukur completeness leluhur
 * dari SATU root, dan dari v313 surname-marriage-matrix yang berbasis
 * NAMA. v326 mengukur hubungan darah ANTARA dua spouse satu union.
 *
 * DEFINISI (kontrak 7aecaf9):
 * - Per union dengan TEPAT 2 spouse id berbeda: jarak generasi dari
 *   tiap spouse ke semua leluhur termasuk dirinya (dist diri = 0,
 *   naik via parentEdges, BFS dengan visited per akar).
 * - Common ancestor = irisan himpunan leluhur (termasuk diri).
 * - k = MINIMUM atas semua common ancestor c dari dist(a,c)+dist(b,c).
 *   k >= 1 untuk spouse beda id. k=1 ortu-anak, k=2 saudara, k=3
 *   paman-keponakan, k=4 sepupu pertama.
 * - proportionPct = 100*with/evaluated round 1 desimal, evaluated 0
 *   -> 0. degreeCounts hanya k ber-count > 0 urut k menaik.
 * - Deterministik: urutan union mengikuti input, tanpa random, tanpa
 *   Date, tanpa I/O. Graph kosong valid, TIDAK throw.
 */

import type { FamilyGraph } from '../genealogy/family-graph'

export interface ConsanguinityDegreeCount {
  /** Jarak gabungan minimum lewat common ancestor (k >= 1). */
  k: number
  count: number
}

export interface ConsanguinityResult {
  /** Union dengan tepat 2 spouse id berbeda (dievaluasi). */
  unionsEvaluated: number
  /** Union yang tidak memenuhi syarat (bukan 2 spouse / id sama). */
  unionsSkipped: number
  /** Union dievaluasi yang punya minimal satu common ancestor. */
  unionsWithCommonAncestor: number
  /** 100 * with / evaluated, round 1 desimal; 0 bila nihil evaluated. */
  proportionPct: number
  /** Hanya k dengan count > 0, urut k menaik. */
  degreeCounts: ConsanguinityDegreeCount[]
}

/** Bangun peta anak -> daftar ortu (urut input, tanpa duplikat ortu). */
function buildParentMap(edges: FamilyGraph['parentEdges']): Map<string, string[]> {
  const map = new Map<string, string[]>()
  for (const edge of edges) {
    const list = map.get(edge.child)
    if (list === undefined) {
      map.set(edge.child, [...edge.parents])
    } else {
      for (const p of edge.parents) {
        if (!list.includes(p)) list.push(p)
      }
    }
  }
  return map
}

/**
 * Himpunan leluhur (termasuk diri) dengan jarak generasi minimum.
 * BFS naik via peta ortu; visited = kunci peta dist sehingga siklus
 * dan jalur ganda otomatis terpotong (aman per akar).
 */
function ancestorDistances(
  start: string,
  parents: Map<string, string[]>,
): Map<string, number> {
  const dist = new Map<string, number>([[start, 0]])
  const queue: string[] = [start]
  let head = 0
  while (head < queue.length) {
    const current = queue[head]
    head += 1
    const d = dist.get(current) as number
    for (const p of parents.get(current) ?? []) {
      if (!dist.has(p)) {
        dist.set(p, d + 1)
        queue.push(p)
      }
    }
  }
  return dist
}

/** Round 1 desimal (pola v325). */
function round1(value: number): number {
  return Math.round(value * 10) / 10
}

/**
 * Statistik konsanguinitas pasangan per union.
 * Input kosong atau tanpa union valid: hasil nol tanpa throw.
 */
export function analyzeConsanguinity(graph: FamilyGraph): ConsanguinityResult {
  const parents = buildParentMap(graph.parentEdges)
  const cache = new Map<string, Map<string, number>>()
  const degreeCountMap = new Map<number, number>()
  let unionsEvaluated = 0
  let unionsSkipped = 0
  let unionsWithCommonAncestor = 0

  for (const union of graph.unions) {
    const [a, b] = union.spouses
    if (union.spouses.length !== 2 || a === b) {
      unionsSkipped += 1
      continue
    }
    unionsEvaluated += 1

    let distA = cache.get(a)
    if (distA === undefined) {
      distA = ancestorDistances(a, parents)
      cache.set(a, distA)
    }
    let distB = cache.get(b)
    if (distB === undefined) {
      distB = ancestorDistances(b, parents)
      cache.set(b, distB)
    }

    let k: number | null = null
    for (const [anc, da] of distA) {
      const db = distB.get(anc)
      if (db !== undefined) {
        const total = da + db
        if (k === null || total < k) k = total
      }
    }

    if (k !== null) {
      unionsWithCommonAncestor += 1
      degreeCountMap.set(k, (degreeCountMap.get(k) ?? 0) + 1)
    }
  }

  const degreeCounts = [...degreeCountMap.entries()]
    .map(([k, count]) => ({ k, count }))
    .sort((x, y) => x.k - y.k)

  const proportionPct =
    unionsEvaluated === 0
      ? 0
      : round1((unionsWithCommonAncestor / unionsEvaluated) * 100)

  return {
    unionsEvaluated,
    unionsSkipped,
    unionsWithCommonAncestor,
    proportionPct,
    degreeCounts,
  }
}
