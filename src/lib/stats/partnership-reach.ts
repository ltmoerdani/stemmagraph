/**
 * Partnership reach (v356 fase i): modul PURE statistik graph kemitraan,
 * pilar 2 VISION-stemmagraph. Jangkar open-source magicsunday/webtrees-statistics
 * PartnershipChains.php (riset 084, diakses 22 Okt 2026): connected components
 * graph pasangan dengan ambang 3 orang, edges = jumlah degree dibagi 2, hub
 * degree dengan tie-break id terkecil, dan diameter path via double BFS
 * deterministik dengan normalisasi orientasi leksikografis.
 *
 * Tanpa import eksternal, tanpa I/O, tanpa Date.now, tanpa random:
 * murni transformasi array pasangan menjadi statistik. Urutan input tidak
 * mengubah hasil: traversal selalu mulai dari id byte-order terkecil dan
 * setiap tie dipecah dengan urutan byte naik.
 *
 * Semantik:
 *   Parser strict ber-prefiks partnership-reach ber-index (pola v355):
 *   payload bukan array, pair bukan objek, pairId atau a atau b bukan string,
 *   a sama dengan b, atau pairId duplikat LEMPAR Error. Duplikasi edge sama
 *   (a-b sama tanpa peduli urutan) didedupe diam-diam.
 *
 *   Connected components: BFS iteratif explicit queue, hanya komponen dengan
 *   minimal MIN_GROUP_SIZE 3 orang dilaporkan (pasangan tunggal bukan rantai,
 *   pola jangkar). Members komponen terurut byte-order naik, daftar komponen
 *   terurut member count menurun, tie-break xref terkecil.
 *
 *   longestChain: diameter komponen terbesar via double BFS. BFS pertama dari
 *   member terkecil mencari endpoint terjauh (tie-break id terkecil), BFS
 *   kedua dari endpoint itu, semua kandidat path pada jarak maksimum
 *   direkonstruksi lewat parent map, dinormalisasi orientasi (path dibanding
 *   dengan reverse-nya, simpan urutan leksikografis lebih kecil), antar
 *   kandidat sepanjang sama pilih urutan id terkecil. Cap MAX_CHAIN 100
 *   sebagai pengaman rekonstruksi.
 */

export interface PartnershipPair {
  pairId: string
  a: string
  b: string
}

export interface PartnershipGroup {
  members: string[]
  edges: number
  hubId: string
  hubDegree: number
  longestChain: string[]
}

export interface PartnershipReachResult {
  largestGroup: PartnershipGroup | null
  componentCount: number
}

/** Ambang minimal anggota komponen agar dilaporkan (jangkar MIN_GROUP_SIZE). */
const MIN_GROUP_SIZE = 3

/** Cap panjang path sebagai pengaman rekonstruksi (jangkar MAX_CHAIN). */
const MAX_CHAIN = 100

interface Adjacency {
  neighbors: Map<string, string[]>
}

function buildAdjacency(pairs: PartnershipPair[]): Adjacency {
  if (!Array.isArray(pairs)) {
    throw new Error('partnership-reach[0]: input harus array pasangan')
  }

  const neighbors = new Map<string, string[]>()
  const seenPairIds = new Set<string>()
  const seenEdges = new Set<string>()

  const addNeighbor = (from: string, to: string): void => {
    const list = neighbors.get(from)
    if (list === undefined) {
      neighbors.set(from, [to])
    } else {
      list.push(to)
    }
  }

  for (let i = 0; i < pairs.length; i += 1) {
    const pair = pairs[i] as unknown
    if (pair === null || typeof pair !== 'object') {
      throw new Error(`partnership-reach[${i}]: pair bukan objek`)
    }
    const { pairId, a, b } = pair as Record<string, unknown>
    if (typeof pairId !== 'string' || typeof a !== 'string' || typeof b !== 'string') {
      throw new Error(`partnership-reach[${i}]: pairId, a, dan b wajib string`)
    }
    if (a === b) {
      throw new Error(`partnership-reach[${i}]: a dan b tidak boleh sama`)
    }
    if (seenPairIds.has(pairId)) {
      throw new Error(`partnership-reach[${i}]: pairId duplikat`)
    }
    seenPairIds.add(pairId)

    const [low, high] = a <= b ? [a, b] : [b, a]
    const edgeKey = `${low}\u0000${high}`
    if (seenEdges.has(edgeKey)) {
      continue
    }
    seenEdges.add(edgeKey)
    addNeighbor(a, b)
    addNeighbor(b, a)
  }

  return { neighbors }
}

function degreeOf(adjacency: Adjacency, id: string): number {
  return adjacency.neighbors.get(id)?.length ?? 0
}

/** Kumpulkan satu komponen via BFS iteratif, balikan members terurut byte naik. */
function collectComponent(
  adjacency: Adjacency,
  startId: string,
  visited: Set<string>,
): string[] {
  const members: string[] = []
  const queue: string[] = [startId]
  visited.add(startId)

  while (queue.length > 0) {
    const node = queue.shift() as string
    members.push(node)
    for (const neighbor of adjacency.neighbors.get(node) ?? []) {
      if (!visited.has(neighbor)) {
        visited.add(neighbor)
        queue.push(neighbor)
      }
    }
  }

  members.sort()
  return members
}

/** Semua komponen lolos ambang, urut member count menurun tie xref terkecil. */
function qualifyingComponents(adjacency: Adjacency): string[][] {
  const visited = new Set<string>()
  const components: string[][] = []
  const starts = Array.from(adjacency.neighbors.keys()).sort()
  for (const start of starts) {
    if (visited.has(start)) {
      continue
    }
    const members = collectComponent(adjacency, start, visited)
    if (members.length < MIN_GROUP_SIZE) {
      continue
    }
    components.push(members)
  }
  components.sort((left, right) => {
    if (right.length !== left.length) {
      return right.length - left.length
    }
    return (left[0] ?? '').localeCompare(right[0] ?? '')
  })
  return components
}

interface BfsResult {
  distance: Map<string, number>
  parent: Map<string, string>
  maxDistance: number
  farthest: string
}

/** BFS deterministik: tetangga dikunjungi byte naik, farthest tie id terkecil. */
function bfsDistances(adjacency: Adjacency, startId: string): BfsResult {
  const distance = new Map<string, number>([[startId, 0]])
  const parent = new Map<string, string>()
  const queue: string[] = [startId]
  let maxDistance = 0
  let farthest = startId

  while (queue.length > 0) {
    const node = queue.shift() as string
    const nodeDepth = distance.get(node) ?? 0
    const list = [...(adjacency.neighbors.get(node) ?? [])].sort()
    for (const neighbor of list) {
      if (distance.has(neighbor)) {
        continue
      }
      distance.set(neighbor, nodeDepth + 1)
      parent.set(neighbor, node)
      queue.push(neighbor)
      const depth = nodeDepth + 1
      if (depth > maxDistance || (depth === maxDistance && neighbor < farthest)) {
        maxDistance = depth
        farthest = neighbor
      }
    }
  }

  return { distance, parent, maxDistance, farthest }
}

function comparePaths(left: string[], right: string[]): number {
  const length = Math.max(left.length, right.length)
  for (let i = 0; i < length; i += 1) {
    const a = left[i] ?? ''
    const b = right[i] ?? ''
    if (a !== b) {
      return a < b ? -1 : 1
    }
  }
  return 0
}

/** Normalisasi orientasi: path dibanding dengan reverse-nya, simpan yang lebih kecil. */
function orientPath(path: string[]): string[] {
  const reversed = [...path].reverse()
  return comparePaths(reversed, path) < 0 ? reversed : path
}

function reconstructPath(
  parent: Map<string, string>,
  startId: string,
  endId: string,
): string[] {
  const reversed: string[] = [endId]
  let current = endId
  while (current !== startId && parent.has(current) && reversed.length < MAX_CHAIN) {
    current = parent.get(current) as string
    reversed.push(current)
  }
  reversed.reverse()
  return reversed
}

/** Diameter path satu komponen via double BFS deterministik pola jangkar. */
function componentDiameterPath(adjacency: Adjacency, members: string[]): string[] {
  const firstSweep = bfsDistances(adjacency, members[0] ?? '')
  const secondSweep = bfsDistances(adjacency, firstSweep.farthest)

  let best: string[] = []
  for (const [node, depth] of secondSweep.distance) {
    if (depth !== secondSweep.maxDistance) {
      continue
    }
    const candidate = orientPath(
      reconstructPath(secondSweep.parent, firstSweep.farthest, node),
    )
    if (
      candidate.length > best.length ||
      (candidate.length === best.length && comparePaths(candidate, best) < 0)
    ) {
      best = candidate
    }
  }
  return best
}

function buildGroup(adjacency: Adjacency, members: string[]): PartnershipGroup {
  let degreeSum = 0
  let hubId = members[0] ?? ''
  let hubDegree = -1
  for (const member of members) {
    degreeSum += degreeOf(adjacency, member)
    const degree = degreeOf(adjacency, member)
    if (degree > hubDegree || (degree === hubDegree && member < hubId)) {
      hubDegree = degree
      hubId = member
    }
  }
  return {
    members,
    edges: degreeSum / 2,
    hubId,
    hubDegree,
    longestChain: componentDiameterPath(adjacency, members),
  }
}

/**
 * Statistik partnership reach: komponen kemitraan terbesar beserta hub dan
 * rantai terpanjangnya, plus jumlah semua komponen yang lolos ambang. Input
 * kosong atau nihil komponen lolos ambang mengembalikan largestGroup null
 * dan componentCount 0 tanpa throw.
 */
export function computePartnershipReach(pairs: PartnershipPair[]): PartnershipReachResult {
  const adjacency = buildAdjacency(pairs)
  const components = qualifyingComponents(adjacency)
  if (components.length === 0) {
    return { largestGroup: null, componentCount: 0 }
  }
  return {
    largestGroup: buildGroup(adjacency, components[0]),
    componentCount: components.length,
  }
}
