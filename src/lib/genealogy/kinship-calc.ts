import type { KinshipGraph } from './kinship'

export type KinshipKind =
  | 'self'
  | 'partner'
  | 'parent'
  | 'child'
  | 'sibling'
  | 'grandparent'
  | 'grandchild'
  | 'parent-sibling'
  | 'sibling-child'
  | 'cousin'
  | 'ancestor'
  | 'descendant'
  | 'unrelated'

export interface RelationshipResult {
  kind: KinshipKind
  depth?: number
}

export interface RelatedPerson {
  personId: string
  kind: KinshipKind
  depth: number
}

/** Batas aman BFS agar loop tak berujung bila graph ternoda siklus. */
const MAX_WALK_DEPTH = 64

/**
 * Relasi kanonik antara dua person dalam graph kekerabatan murni.
 *
 * Pure function: membaca graph, tanpa efek samping. Urutan pemeriksaan
 * menentukan kind saat satu person memenuhi lebih dari satu kategori
 * (mis. istri ayah yang sekaligus nenek: partner menang karena depth
 * paling dangkal dan paling spesifik menurut konvensi silsilah).
 */
export function canonicalRelationship(
  graph: KinshipGraph,
  fromId: string,
  toId: string,
): RelationshipResult {
  if (fromId === toId) {
    return { kind: 'self', depth: 0 }
  }

  const parents = graph.parentsOf(fromId)
  const children = graph.childrenOf(fromId)
  const siblings = graph.siblingsOf(fromId)

  if ((graph.partners.get(fromId) ?? []).includes(toId)) {
    return { kind: 'partner', depth: 1 }
  }
  if (parents.includes(toId)) {
    return { kind: 'parent', depth: 1 }
  }
  if (children.includes(toId)) {
    return { kind: 'child', depth: 1 }
  }
  if (siblings.includes(toId)) {
    return { kind: 'sibling', depth: 1 }
  }

  const grandparents = parents.flatMap((p) => graph.parentsOf(p))
  if (grandparents.includes(toId)) {
    return { kind: 'grandparent', depth: 2 }
  }

  const grandchildren = children.flatMap((c) => graph.childrenOf(c))
  if (grandchildren.includes(toId)) {
    return { kind: 'grandchild', depth: 2 }
  }

  const parentSiblings = parents.flatMap((p) => graph.siblingsOf(p))
  if (parentSiblings.includes(toId)) {
    return { kind: 'parent-sibling', depth: 2 }
  }

  const siblingChildren = siblings.flatMap((s) => graph.childrenOf(s))
  if (siblingChildren.includes(toId)) {
    return { kind: 'sibling-child', depth: 2 }
  }

  const cousins = parentSiblings.flatMap((ps) => graph.childrenOf(ps))
  if (cousins.includes(toId)) {
    return { kind: 'cousin', depth: 2 }
  }

  // Kakek buyut ke atas: BFS lewat parents, depth aktual dihitung.
  const ancestorDepth = walkDepth(graph.parentsOf, fromId, toId)
  if (ancestorDepth !== undefined) {
    return { kind: 'ancestor', depth: ancestorDepth }
  }

  // Cicit ke bawah: BFS lewat children, depth aktual dihitung.
  const descendantDepth = walkDepth(graph.childrenOf, fromId, toId)
  if (descendantDepth !== undefined) {
    return { kind: 'descendant', depth: descendantDepth }
  }

  return { kind: 'unrelated' }
}

/**
 * Jarak generasi dari origin ke target mengikuti edge selector (parents
 * atau children), undefined bila tak terjangkau. Level 1 dan 2 sudah
 * ditangani pemanggil, jadi hasil yang relevan mulai dari 3.
 */
function walkDepth(
  edgesOf: (id: string) => string[],
  origin: string,
  target: string,
): number | undefined {
  const visited = new Set<string>([origin])
  let frontier = [origin]
  for (let depth = 1; depth <= MAX_WALK_DEPTH; depth += 1) {
    const next: string[] = []
    for (const node of frontier) {
      for (const nb of edgesOf(node)) {
        if (nb === target) {
          return depth
        }
        if (!visited.has(nb)) {
          visited.add(nb)
          next.push(nb)
        }
      }
    }
    if (next.length === 0) {
      return undefined
    }
    frontier = next
  }
  return undefined
}

/**
 * Daftar seluruh person lain beserta relasinya terhadap fromId.
 *
 * Kandidat dikumpulkan dari key partner map dan BFS empat arah relasi
 * sehingga semua person dalam komponen terhubung tercakup; person yang
 * benar-benar terpisah tetap terhitung bila muncul sebagai key partner.
 * Urutan hasil deterministik: depth menaik, lalu personId alfabetis.
 */
export function listRelationships(
  graph: KinshipGraph,
  fromId: string,
): RelatedPerson[] {
  const persons = new Set<string>()
  for (const [key, vals] of graph.partners.entries()) {
    persons.add(key)
    for (const v of vals) {
      persons.add(v)
    }
  }

  const queue = [fromId]
  const seen = new Set<string>([fromId])
  while (queue.length > 0) {
    const curr = queue.shift() as string
    const neighbors = [
      ...(graph.partners.get(curr) ?? []),
      ...graph.parentsOf(curr),
      ...graph.childrenOf(curr),
      ...graph.siblingsOf(curr),
    ]
    for (const n of neighbors) {
      persons.add(n)
      if (!seen.has(n)) {
        seen.add(n)
        queue.push(n)
      }
    }
  }

  persons.delete(fromId)

  const results: RelatedPerson[] = []
  for (const personId of persons) {
    const rel = canonicalRelationship(graph, fromId, personId)
    results.push({
      personId,
      kind: rel.kind,
      depth: rel.depth ?? Number.MAX_SAFE_INTEGER,
    })
  }

  results.sort((a, b) => {
    if (a.depth !== b.depth) {
      return a.depth - b.depth
    }
    return a.personId < b.personId ? -1 : a.personId > b.personId ? 1 : 0
  })

  return results
}
