/**
 * Endogamy summary (v349 fase i): modul PURE statistik endogami
 * keluarga. Jangkar riset: getEndogamySummary wt_statistic.php
 * baris 743. Saudara consanguinity.ts (v326) dan modul stats lain.
 *
 * METRIK: proporsi pasangan satu union yang berbagi leluhur dalam
 * kedalaman generasi tertentu (default 4).
 *
 * DEFINISI (kontrak drafts/kontrak-stg-v349-endogamy-summary):
 * - Union testable: tepat 2 spouse id berbeda dan KEDUA id punya
 *   jejak parentage (muncul sebagai edge.child di parentEdges).
 *   Id tanpa jejak parentage tidak testable.
 * - Leluhur termasuk diri per spouse: BFS naik via peta child ->
 *   parents (dedup ortu per child), dist diri = 0, visited per
 *   akar sehingga siklus dan jalur ganda terpotong.
 * - Union shared: ada common ancestor c dengan
 *   distA(c) + distB(c) <= maxDepth.
 * - proportionPct = 100 * shared / testable round 1 desimal,
 *   testable 0 -> 0.
 * - Validasi input strict ber-index, prefiks endogamy-summary.
 * - Deterministik: tanpa I/O, tanpa Date, tanpa random. Graph
 *   kosong atau tanpa union valid, hasil nol tanpa throw.
 */

import type { FamilyGraph, ParentEdge, UnionNode } from '../genealogy/family-graph'

const ERROR_PREFIX = 'endogamy-summary'
const DEFAULT_MAX_DEPTH = 4

export interface EndogamySummaryResult {
  /** Union dengan 2 spouse berbeda yang punya jejak parentage. */
  testable: number
  /** Union testable yang punya common ancestor dalam maxDepth. */
  shared: number
  /** 100 * shared / testable, round 1 desimal; 0 bila nihil testable. */
  proportionPct: number
  /** Batas kedalaman generasi efektif (default 4). */
  maxDepth: number
}

export interface EndogamySummaryOptions {
  /** Batas kedalaman generasi, integer >= 1, default 4. */
  maxDepth?: number
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

/** Bangun peta anak -> daftar ortu (urut input, tanpa duplikat ortu). */
function buildParentMap(edges: ParentEdge[]): Map<string, string[]> {
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
 * BFS naik via peta ortu; kunci peta dist dipakai sebagai visited
 * sehingga siklus dan jalur ganda otomatis terpotong (aman per akar).
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

/**
 * Ringkasan endogami pasangan per union.
 * Input kosong atau tanpa union valid: hasil nol tanpa throw.
 */
export function analyzeEndogamy(
  graph: FamilyGraph,
  options?: EndogamySummaryOptions,
): EndogamySummaryResult {
  if (!isRecord(graph)) {
    throw new Error(`${ERROR_PREFIX}: graph harus objek`)
  }
  if (!Array.isArray(graph.personIds)) {
    throw new Error(`${ERROR_PREFIX}: graph.personIds harus array`)
  }
  if (!Array.isArray(graph.unions)) {
    throw new Error(`${ERROR_PREFIX}: graph.unions harus array`)
  }
  if (!Array.isArray(graph.parentEdges)) {
    throw new Error(`${ERROR_PREFIX}: graph.parentEdges harus array`)
  }

  const maxDepth = options?.maxDepth ?? DEFAULT_MAX_DEPTH
  if (!Number.isInteger(maxDepth) || maxDepth < 1) {
    throw new Error(
      `${ERROR_PREFIX}: options.maxDepth harus integer >= 1, diterima ${String(options?.maxDepth)}`,
    )
  }

  const rawUnions = graph.unions as unknown[]
  for (let i = 0; i < rawUnions.length; i += 1) {
    const raw = rawUnions[i]
    if (!isRecord(raw)) {
      throw new Error(`${ERROR_PREFIX}: union index ${i} bukan objek`)
    }
    if (!Array.isArray(raw.spouses)) {
      throw new Error(`${ERROR_PREFIX}: union index ${i} spouses harus array`)
    }
    const spouses = raw.spouses as unknown[]
    for (let j = 0; j < spouses.length; j += 1) {
      const s = spouses[j]
      if (typeof s !== 'string' || s.length === 0) {
        throw new Error(
          `${ERROR_PREFIX}: union index ${i} spouse index ${j} harus string tidak kosong`,
        )
      }
    }
  }

  const rawEdges = graph.parentEdges as unknown[]
  for (let i = 0; i < rawEdges.length; i += 1) {
    const raw = rawEdges[i]
    if (!isRecord(raw)) {
      throw new Error(`${ERROR_PREFIX}: parentEdges index ${i} bukan objek`)
    }
    if (typeof raw.child !== 'string' || raw.child.length === 0) {
      throw new Error(
        `${ERROR_PREFIX}: parentEdges index ${i} child harus string tidak kosong`,
      )
    }
    if (!Array.isArray(raw.parents)) {
      throw new Error(`${ERROR_PREFIX}: parentEdges index ${i} parents harus array`)
    }
    const parentsList = raw.parents as unknown[]
    for (let j = 0; j < parentsList.length; j += 1) {
      if (typeof parentsList[j] !== 'string') {
        throw new Error(
          `${ERROR_PREFIX}: parentEdges index ${i} parents index ${j} harus string`,
        )
      }
    }
  }

  const parents = buildParentMap(graph.parentEdges as ParentEdge[])
  const cache = new Map<string, Map<string, number>>()
  let testable = 0
  let shared = 0

  for (const union of graph.unions as UnionNode[]) {
    const [a, b] = union.spouses
    if (union.spouses.length !== 2 || a === b) continue
    if (!parents.has(a) || !parents.has(b)) continue
    testable += 1

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

    for (const [anc, da] of distA) {
      const db = distB.get(anc)
      if (db !== undefined && da + db <= maxDepth) {
        shared += 1
        break
      }
    }
  }

  const proportionPct =
    testable === 0 ? 0 : Math.round(((100 * shared) / testable) * 10) / 10

  return { testable, shared, proportionPct, maxDepth }
}
