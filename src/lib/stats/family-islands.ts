/**
 * Family islands (v358 fase i): modul PURE statistik pulau keluarga,
 * pilar 2 VISION-stemmagraph. Jangkar open-source magicsunday/webtrees-statistics
 * (riset wake-120, diakses 22 Okt 2026): connected components atas graph
 * statistik. Tidak ada modul FamilyIslands eksplisit di repo jangkar:
 * derivasi PM dari metode graph-statistics yang sama, preseden derivasi
 * v356 PartnershipChains dan v357 GenerationDepth.
 *
 * Tanpa import eksternal, tanpa I/O, tanpa Date.now, tanpa random: murni
 * transformasi array edge parentage menjadi statistik pulau. Urutan input
 * tidak mengubah hasil: traversal BFS selalu mulai dari id byte-order
 * terkecil yang belum dikunjungi dan tetangga setiap node diurutkan id naik.
 *
 * Semantik:
 *   Pulau = connected component pada graph TAK BERARAH dari edges
 *   parentage (childId-parentId). Dua node terhubung bila terhubung
 *   langsung atau transitif lewat edges parentage apa pun arah: kakek,
 *   parent, anak, dan cucu tetap satu pulau meski arah edge konsisten
 *   anak-ke-ortu.
 *
 *   Edge duplikat dan edge berlawanan arah didedupe sebelum analisis
 *   (pola v282 dan v357): child-parent dan parent-child untuk pasangan id
 *   sama dihitung satu edge tak berarah.
 *
 *   Node hanya muncul dari edges, sehingga setiap node memiliki minimal
 *   satu edge dan ukuran pulau minimal 2.
 *
 *   Parser strict ber-prefiks family-islands ber-index (pola v349-v357):
 *   edges bukan array, entri bukan objek, childId atau parentId bukan
 *   string atau string kosong: LEMPAR Error ber-index. Tidak ada options
 *   pada goal ini.
 */

export interface ParentageEdge {
  childId: string
  parentId: string
}

export interface FamilyIslandsResult {
  /** Jumlah pulau (connected component); graph nihil node = 0. */
  islandCount: number
  /** Ukuran pulau terbesar; 0 bila nihil. */
  largestIslandSize: number
  /** Histogram ukuran pulau, urut size ascending, tanpa entri bercount 0. */
  distribution: Array<{ size: number; count: number }>
  /** Semua node unik dari edges. */
  nodeCount: number
}

/** Pemisah kunci edge normalisasi tak berarah (tak ada di id). */
const EDGE_KEY_SEPARATOR = '\u0000'

interface Adjacency {
  neighbors: Map<string, string[]>
}

/**
 * Validasi strict edges dan bangun adjacency tak berarah hasil dedupe.
 * Kunci edge dinormalisasi leksikografis sehingga duplikat dan
 * berlawanan arah jatuh pada kunci yang sama.
 */
function parseAndBuildAdjacency(edges: ParentageEdge[]): Adjacency {
  if (!Array.isArray(edges)) {
    throw new Error('family-islands[0]: input harus array edge')
  }

  const neighbors = new Map<string, string[]>()
  const seenEdges = new Set<string>()

  for (let i = 0; i < edges.length; i += 1) {
    const entry = edges[i] as unknown
    if (entry === null || typeof entry !== 'object') {
      throw new Error(`family-islands[${i}]: entri harus objek edge`)
    }

    const childId: unknown = (entry as { childId?: unknown }).childId
    const parentId: unknown = (entry as { parentId?: unknown }).parentId
    if (typeof childId !== 'string' || childId === '') {
      throw new Error(`family-islands[${i}]: childId harus string tak kosong`)
    }
    if (typeof parentId !== 'string' || parentId === '') {
      throw new Error(`family-islands[${i}]: parentId harus string tak kosong`)
    }

    const key =
      childId < parentId
        ? `${childId}${EDGE_KEY_SEPARATOR}${parentId}`
        : `${parentId}${EDGE_KEY_SEPARATOR}${childId}`
    if (seenEdges.has(key)) {
      continue
    }
    seenEdges.add(key)

    const childList = neighbors.get(childId)
    if (childList === undefined) {
      neighbors.set(childId, [parentId])
    } else {
      childList.push(parentId)
    }

    const parentList = neighbors.get(parentId)
    if (parentList === undefined) {
      neighbors.set(parentId, [childId])
    } else {
      parentList.push(childId)
    }
  }

  for (const list of neighbors.values()) {
    list.sort()
  }

  return { neighbors }
}

/**
 * Hitung statistik pulau keluarga dari edges parentage. Deterministik
 * terhadap urutan input edges.
 */
export function computeFamilyIslands(edges: ParentageEdge[]): FamilyIslandsResult {
  const { neighbors } = parseAndBuildAdjacency(edges)

  const nodeIds = [...neighbors.keys()].sort()
  const visited = new Set<string>()
  const islandSizes: number[] = []

  for (const start of nodeIds) {
    if (visited.has(start)) {
      continue
    }

    // BFS iteratif: mulai dari id terkecil yang belum dikunjungi,
    // tetangga sudah terurut id ascending sejak build adjacency.
    let size = 0
    const queue: string[] = [start]
    visited.add(start)
    let head = 0
    while (head < queue.length) {
      const current = queue[head]
      head += 1
      size += 1
      for (const next of neighbors.get(current) ?? []) {
        if (!visited.has(next)) {
          visited.add(next)
          queue.push(next)
        }
      }
    }
    islandSizes.push(size)
  }

  const sizeHistogram = new Map<number, number>()
  let largestIslandSize = 0
  for (const size of islandSizes) {
    sizeHistogram.set(size, (sizeHistogram.get(size) ?? 0) + 1)
    if (size > largestIslandSize) {
      largestIslandSize = size
    }
  }

  const distribution = [...sizeHistogram.entries()]
    .map(([size, count]) => ({ size, count }))
    .sort((a, b) => a.size - b.size)

  return {
    islandCount: islandSizes.length,
    largestIslandSize,
    distribution,
    nodeCount: nodeIds.length,
  }
}
