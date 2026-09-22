import type { KinshipKind, RelationshipResult } from './kinship-calc'

/**
 * Frasa kekerabatan naratif dari hasil canonicalRelationship.
 *
 * Pure function: hanya membaca kind + depth, tanpa import server, prisma,
 * schema, store, atau react. RelationshipResult tidak membawa data gender,
 * sehingga label depth 1 memakai pasangan netral deterministik sesuai
 * kosakata notes/310 (ayah atau ibu, suami atau istri, kakak atau adik).
 * Kind di luar kosakata mengembalikan frasa fallback tanpa throw.
 */
export function kinshipPhrase(result: RelationshipResult, lang: 'id' | 'en'): string {
  switch (result.kind as KinshipKind) {
    case 'self':
      return lang === 'id' ? 'Anda sendiri' : 'yourself'
    case 'partner':
      return lang === 'id' ? 'suami atau istri' : 'husband or wife'
    case 'parent':
      return lang === 'id' ? 'ayah atau ibu' : 'father or mother'
    case 'child':
      return lang === 'id' ? 'anak laki-laki atau anak perempuan' : 'son or daughter'
    case 'sibling':
      return lang === 'id' ? 'kakak atau adik' : 'older or younger sibling'
    case 'grandparent':
      return lang === 'id' ? 'kakek atau nenek' : 'grandfather or grandmother'
    case 'grandchild':
      return lang === 'id' ? 'cucu' : 'grandson or granddaughter'
    case 'parent-sibling':
      return lang === 'id'
        ? 'paman atau bibi (saudara ayah atau ibu)'
        : "uncle or aunt (parent's sibling)"
    case 'sibling-child':
      return lang === 'id'
        ? 'keponakan (anak saudara)'
        : "nephew or niece (sibling's child)"
    case 'cousin':
      return lang === 'id' ? 'sepupu' : 'cousin'
    case 'ancestor':
      return ancestorPhrase(result.depth, lang)
    case 'descendant':
      return descendantPhrase(result.depth, lang)
    case 'unrelated':
      return lang === 'id' ? 'tidak ada hubungan kekerabatan' : 'no known relationship'
    default:
      return lang === 'id' ? 'hubungan tidak dikenal' : 'unknown relationship'
  }
}

/** Leluhur: depth 2 kakek atau nenek, 3 buyut, 4 canggah, sisanya generik. */
function ancestorPhrase(depth: number | undefined, lang: 'id' | 'en'): string {
  const d = depth ?? 1
  if (lang === 'id') {
    if (d <= 2) return 'kakek atau nenek'
    if (d === 3) return 'buyut'
    if (d === 4) return 'canggah'
    return `leluhur ${d} generasi`
  }
  if (d <= 2) return 'grandfather or grandmother'
  return `${'great-'.repeat(d - 2)}grandparent`
}

/** Keturunan: depth 2 cucu, 3 cicit, sisanya generik. */
function descendantPhrase(depth: number | undefined, lang: 'id' | 'en'): string {
  const d = depth ?? 1
  if (lang === 'id') {
    if (d <= 2) return 'cucu'
    if (d === 3) return 'cicit'
    return `keturunan ${d} generasi`
  }
  if (d <= 2) return 'grandson or granddaughter'
  return `${'great-'.repeat(d - 2)}grandchild`
}
