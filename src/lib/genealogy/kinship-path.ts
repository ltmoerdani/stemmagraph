import type { KinshipGraph } from './kinship'
import type { KinshipKind } from './kinship-calc'

/** Satu hop di jalur kekerabatan: person yang dituju beserta kind relasinya. */
export interface KinshipPathHop {
  personId: string
  kind: KinshipKind
}

/** Hasil pencarian jalur kekerabatan antara dua person. */
export interface KinshipPathResult {
  found: boolean
  hops: KinshipPathHop[]
  linearity: 'langsung' | 'naik' | 'turun' | 'afinal'
}

/**
 * Klasifikasi linearity dari urutan hop di jalur.
 *
 * Definisi eksak (dikunci test):
 * - "afinal": jalur memuat minimal satu hop partner. Relasi yang
 *   menempuh pernikahan (mertua, menantu, besan) adalah relasi
 *   afinal menurut kaidah kekerabatan Indonesia, apa pun arah
 *   generasi hop non-partner sesudahnya.
 * - "naik": tanpa hop partner dan tanpa hop sibling, semua hop naik
 *   (parent/grandparent/ancestor).
 * - "turun": tanpa hop partner dan tanpa hop sibling, semua hop turun
 *   (child/grandchild/descendant).
 * - "langsung": semua sisanya: self, hop sibling murni (saudara),
 *   dan rantai kolateral campuran arah (sepupu, keponakan kakak).
 */
function classifyLinearity(
  hops: KinshipPathHop[],
): KinshipPathResult['linearity'] {
  if (hops.length === 0) {
    return 'langsung'
  }
  if (hops.length === 1 && hops[0].kind === 'self') {
    return 'langsung'
  }

  const naik = new Set<KinshipKind>(['parent', 'grandparent', 'ancestor'])
  const turun = new Set<KinshipKind>(['child', 'grandchild', 'descendant'])

  let adaPartner = false
  let adaSibling = false
  let adaNaik = false
  let adaTurun = false
  for (const hop of hops) {
    if (hop.kind === 'partner') {
      adaPartner = true
    } else if (hop.kind === 'sibling') {
      adaSibling = true
    } else if (naik.has(hop.kind)) {
      adaNaik = true
    } else if (turun.has(hop.kind)) {
      adaTurun = true
    }
  }

  if (adaPartner) {
    return 'afinal'
  }
  if (adaSibling) {
    return 'langsung'
  }
  if (adaNaik && !adaTurun) {
    return 'naik'
  }
  if (adaTurun && !adaNaik) {
    return 'turun'
  }
  return 'langsung'
}

function bandingkanId(a: string, b: string): number {
  return a < b ? -1 : a > b ? 1 : 0
}

/**
 * Cari jalur kekerabatan terpendek dari fromId ke toId di atas
 * KinshipGraph (hop partner, child, parent, sibling).
 *
 * BFS level demi level dengan tie-break leksikografis personId supaya
 * hasil deterministik: node di level berikutnya dikunjungi urut ID, dan
 * jalur tersimpan untuk node pertama yang menjangkaunya.
 *
 * Guard depth 64 pola kinship-calc: graph bersiklus tidak boleh
 * membuat infinite loop.
 *
 * Pure: tanpa efek samping, output hanya fungsi input.
 */
export function resolveKinshipPath(
  graph: KinshipGraph,
  fromId: string,
  toId: string,
): KinshipPathResult {
  const MAX_DEPTH = 64

  if (fromId === toId) {
    return {
      found: true,
      hops: [{ personId: fromId, kind: 'self' }],
      linearity: 'langsung',
    }
  }

  interface NodeFrontier {
    id: string
    path: KinshipPathHop[]
  }

  const visited = new Set<string>([fromId])
  let frontier: NodeFrontier[] = [{ id: fromId, path: [] }]

  for (let depth = 1; depth <= MAX_DEPTH; depth++) {
    // Kumpulkan kandidat level berikutnya. Node pertama yang menjangkau
    // sebuah ID memenangkan jalurnya (BFS terpendek), tie-break urut ID.
    const kandidat = new Map<string, KinshipPathHop[]>()
    for (const node of frontier) {
      const tetangga: Array<{ id: string; kind: KinshipKind }> = []
      for (const p of graph.partners.get(node.id) ?? []) {
        tetangga.push({ id: p, kind: 'partner' })
      }
      for (const c of graph.childrenOf(node.id)) {
        tetangga.push({ id: c, kind: 'child' })
      }
      for (const p of graph.parentsOf(node.id)) {
        tetangga.push({ id: p, kind: 'parent' })
      }
      for (const s of graph.siblingsOf(node.id)) {
        tetangga.push({ id: s, kind: 'sibling' })
      }
      tetangga.sort((a, b) => bandingkanId(a.id, b.id))
      for (const t of tetangga) {
        if (visited.has(t.id) || kandidat.has(t.id)) {
          continue
        }
        kandidat.set(t.id, [
          ...node.path,
          { personId: t.id, kind: t.kind },
        ])
      }
    }
    if (kandidat.size === 0) {
      break
    }

    const jalur = kandidat.get(toId)
    if (jalur) {
      return {
        found: true,
        hops: jalur,
        linearity: classifyLinearity(jalur),
      }
    }

    for (const id of kandidat.keys()) {
      visited.add(id)
    }
    frontier = [...kandidat.entries()]
      .sort((a, b) => bandingkanId(a[0], b[0]))
      .map(([id, path]) => ({ id, path }))
  }

  return { found: false, hops: [], linearity: 'langsung' }
}
