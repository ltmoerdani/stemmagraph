/**
 * Descendant depth (v357 fase i): modul PURE statistik kedalaman keturunan,
 * pilar 2 VISION-stemmagraph. Jangkar open-source magicsunday/webtrees-statistics
 * GenerationDepth.php (riset wake-120, diakses 22 Okt 2026): depth individu
 * dihitung sebagai jumlah generasi keturunan tercatat di bawahnya, leaf 0,
 * orang tua dari anak berdepth 1, dan seterusnya.
 *
 * Tanpa import eksternal, tanpa I/O, tanpa Date.now, tanpa random: murni
 * transformasi array edge parentage menjadi histogram depth. Urutan input
 * tidak mengubah hasil: node diproses id byte-order naik dan anak tiap node
 * diurutkan id naik.
 *
 * Semantik:
 *   depth(node) = 1 + maksimum depth semua anaknya; leaf = 0. Semua node
 *   yang muncul di graph (sebagai child atau parent) masuk histogram,
 *   termasuk node yang hanya berperan parent tanpa parent sendiri.
 *
 *   Pedigree collapse (satu anak terjangkau dari beberapa jalur): memoisasi
 *   longest-path sehingga depth mengambil jalur TERPANJANG, setia jangkar.
 *
 *   Cap: bila depth suatu node menyentuh maxDepth (default 100), node
 *   di-clamp ke maxDepth dan flag capped = true (jangkar: depth === cap
 *   dihitung capped, termasuk rantai sah yang tepat menyentuh cap). Walk
 *   DFS dilindungi on-path set sehingga siklus berhingga; node pada siklus
 *   berujung clamp di cap dan capped true.
 *
 *   Parser strict ber-prefiks descendant-depth ber-index (pola v349-v351):
 *   edges bukan array, entri bukan objek, childId atau parentId bukan string
 *   atau string kosong, options.maxDepth ada tapi bukan integer >= 1:
 *   LEMPAR Error. Edge duplikat didedupe diam-diam sebelum analisis.
 */

export interface DescendantEdge {
  childId: string
  parentId: string
}

export interface DescendantDepthResult {
  maxDepth: number
  distribution: Array<{ depth: number; count: number }>
  capped: boolean
  nodeCount: number
}

/** Cap default kedalaman keturunan (jangkar MAX_DEPTH). */
const DEFAULT_MAX_DEPTH = 100

/**
 * Hitung histogram kedalaman keturunan untuk semua node pada graph
 * parentage. Deterministik terhadap urutan input edges.
 */
export function computeDescendantDepth(
  edges: DescendantEdge[],
  options?: { maxDepth?: number },
): DescendantDepthResult {
  if (!Array.isArray(edges)) {
    throw new Error('descendant-depth[0]: input harus array edge')
  }

  const maxDepth = parseMaxDepth(options)

  const childIds: string[] = []
  const parentIds: string[] = []
  const seen = new Set<string>()
  for (let i = 0; i < edges.length; i += 1) {
    const edge = edges[i] as unknown
    if (typeof edge !== 'object' || edge === null) {
      throw new Error(`descendant-depth[${i}]: edge bukan objek`)
    }
    const candidate = edge as Partial<DescendantEdge>
    if (
      typeof candidate.childId !== 'string' ||
      typeof candidate.parentId !== 'string' ||
      candidate.childId.length === 0 ||
      candidate.parentId.length === 0
    ) {
      throw new Error(`descendant-depth[${i}]: childId dan parentId wajib string tak kosong`)
    }
    const key = `${candidate.childId}\u0000${candidate.parentId}`
    if (seen.has(key)) continue
    seen.add(key)
    childIds.push(candidate.childId)
    parentIds.push(candidate.parentId)
  }

  const nodes = Array.from(new Set([...childIds, ...parentIds])).sort()
  if (nodes.length === 0) {
    // Graph nihil node: maksimum depth cache atas himpunan kosong = 0,
    // distribution tetap satu entri depth 0 bercount 0 (setia jangkar).
    return {
      maxDepth: 0,
      distribution: [{ depth: 0, count: 0 }],
      capped: false,
      nodeCount: 0,
    }
  }

  const childrenOf = new Map<string, string[]>()
  for (let i = 0; i < childIds.length; i += 1) {
    const parent = parentIds[i]
    const child = childIds[i]
    const list = childrenOf.get(parent)
    if (list) {
      if (!list.includes(child)) list.push(child)
    } else {
      childrenOf.set(parent, [child])
    }
  }
  for (const [parent, list] of childrenOf) {
    childrenOf.set(parent, [...list].sort())
  }

  const depthCache = new Map<string, number>()
  let anyCapped = false

  const resolveDepth = (node: string, onPath: Set<string>): number => {
    const cached = depthCache.get(node)
    if (cached !== undefined) return cached
    const kids = childrenOf.get(node)
    if (!kids || kids.length === 0) {
      depthCache.set(node, 0)
      return 0
    }
    if (onPath.has(node)) {
      // Siklus pada jalur aktif: clamp di cap, walk tetap berhingga
      // (setia jangkar: on-path set anti infinite loop).
      depthCache.set(node, maxDepth)
      return maxDepth
    }
    onPath.add(node)
    let best = 0
    for (const child of kids) {
      const candidate = resolveDepth(child, onPath)
      if (candidate > best) best = candidate
    }
    onPath.delete(node)
    let depth = best + 1
    if (depth >= maxDepth) {
      depth = maxDepth
      anyCapped = true
    }
    depthCache.set(node, depth)
    return depth
  }

  for (const node of nodes) {
    resolveDepth(node, new Set<string>())
  }

  const histogram = new Map<number, number>()
  for (const node of nodes) {
    const depth = depthCache.get(node) as number
    histogram.set(depth, (histogram.get(depth) ?? 0) + 1)
  }

  let maxObserved = 0
  for (const node of nodes) {
    const depth = depthCache.get(node) as number
    if (depth > maxObserved) maxObserved = depth
  }
  const distribution: Array<{ depth: number; count: number }> = []
  for (let depth = 0; depth <= maxObserved; depth += 1) {
    distribution.push({ depth, count: histogram.get(depth) ?? 0 })
  }

  return {
    maxDepth: maxObserved,
    distribution,
    capped: anyCapped,
    nodeCount: nodes.length,
  }
}

function parseMaxDepth(options?: { maxDepth?: number }): number {
  if (options === undefined) return DEFAULT_MAX_DEPTH
  if (typeof options !== 'object' || options === null) {
    throw new Error('descendant-depth[options]: options bukan objek')
  }
  const raw = (options as { maxDepth?: unknown }).maxDepth
  if (raw === undefined) return DEFAULT_MAX_DEPTH
  if (typeof raw !== 'number' || !Number.isInteger(raw) || raw < 1) {
    throw new Error('descendant-depth[options]: maxDepth wajib integer >= 1')
  }
  return raw
}
