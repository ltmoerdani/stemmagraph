export type { PartnerRelation, RelationshipType } from './relationship'
export type { GenealogicalEvent } from './event-model'
export { EVENT_TYPES, isEventType, makeEvent } from './event-model'
export { makePartnerRelation } from './relationship'

/** Link anak ke orang tua untuk input buildKinshipGraph. */
export interface ChildLink {
  childId: string
  parentId: string
  type: RelationshipType
}

/** Hasil graph: akses relasi lewat fungsi query, bukan struktur mentah. */
export interface KinshipGraph {
  /** Pasangan tiap person; satu person boleh punya lebih dari satu pasangan. */
  partners: Map<string, string[]>
  parentsOf: (childId: string) => string[]
  childrenOf: (parentId: string) => string[]
  siblingsOf: (id: string) => string[]
  ancestorsOf: (id: string, maxDepth: number) => string[]
  descendantsOf: (id: string, maxDepth: number) => string[]
}

/**
 * Bangun graph kekerabatan murni dari input eksplisit.
 *
 * Pure function: tanpa import server/prisma, tanpa state global, tanpa
 * inferensi gender. Urutan hasil mengikuti urutan input yang stabil
 * (insertion order, duplikat link otomatis dihindari), sehingga pemanggilan
 * dua kali dengan input sama menghasilkan output identik.
 */
export function buildKinshipGraph(
  persons: Iterable<string>,
  partnerLinks: readonly PartnerRelation[],
  childLinks: readonly ChildLink[],
): KinshipGraph {
  const personSet = new Set(persons)

  const partners = new Map<string, string[]>()
  const parents = new Map<string, string[]>()
  const children = new Map<string, string[]>()

  const ensure = (m: Map<string, string[]>, k: string): string[] => {
    let v = m.get(k)
    if (!v) {
      v = []
      m.set(k, v)
    }
    return v
  }

  const pushUnique = (arr: string[], id: string): void => {
    if (!arr.includes(id)) {
      arr.push(id)
    }
  }

  for (const link of partnerLinks) {
    const [a, b] = link.partners
    if (a === b) {
      continue
    }
    pushUnique(ensure(partners, a), b)
    pushUnique(ensure(partners, b), a)
  }

  for (const link of childLinks) {
    if (link.childId === link.parentId) {
      continue
    }
    if (!personSet.has(link.childId) || !personSet.has(link.parentId)) {
      continue
    }
    pushUnique(ensure(parents, link.childId), link.parentId)
    pushUnique(ensure(children, link.parentId), link.childId)
  }

  const siblings = new Map<string, string[]>()
  for (const id of personSet) {
    // Saudara: berbagi minimal satu orang tua, diri sendiri tidak termasuk.
    const sibs: string[] = []
    for (const p of parents.get(id) ?? []) {
      for (const c of children.get(p) ?? []) {
        if (c !== id) {
          pushUnique(sibs, c)
        }
      }
    }
    siblings.set(id, sibs)
  }

  // BFS deterministik dari satu titik, maksimal maxDepth level.
  const walk = (
    start: string,
    edges: Map<string, string[]>,
    maxDepth: number,
  ): string[] => {
    const visited = new Set<string>([start])
    let frontier = [start]
    let depth = 0
    while (frontier.length > 0 && depth < maxDepth) {
      const next: string[] = []
      for (const node of frontier) {
        for (const nb of edges.get(node) ?? []) {
          if (!visited.has(nb)) {
            visited.add(nb)
            next.push(nb)
          }
        }
      }
      frontier = next
      depth += 1
    }
    visited.delete(start)
    return [...visited]
  }

  return {
    partners,
    parentsOf: (childId) => [...(parents.get(childId) ?? [])],
    childrenOf: (parentId) => [...(children.get(parentId) ?? [])],
    siblingsOf: (id) => [...(siblings.get(id) ?? [])],
    ancestorsOf: (id, maxDepth) => walk(id, parents, maxDepth),
    descendantsOf: (id, maxDepth) => walk(id, children, maxDepth),
  }
}
