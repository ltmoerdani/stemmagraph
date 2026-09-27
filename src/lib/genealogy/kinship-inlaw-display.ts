/**
 * Display label in-law untuk frasa baku, GOAL v180-i fase ii (konsumen UI).
 *
 * Jembatan antara leksikon pure kinship-inlaw.ts dan kontrak tampilan
 * AliasDisplay (kinship-alias-note.ts). Pure module: nihil import i18n,
 * store, react. Urutan panggilan di konsumen UI: aliasDisplay dulu,
 * lalu inlawDisplayForPhrase bila alias nihil, sehingga frasa alias
 * regional tetap lewat jalur alias dan label baku in-law lewat jalur ini.
 */
import { inlawLabel, inlawLabels, type InlawRelation } from './kinship-inlaw'
import type { AliasDisplay } from './kinship-alias-note'

/** Kombinasi bermakna label baku in-law beserta relasi sumbernya. */
const INLAW_PHRASE_RELATIONS: ReadonlyArray<{
  readonly labelId: string
  readonly relation: InlawRelation
}> = [
  { labelId: 'pasangan', relation: { basis: 'self', modifier: 'spouse' } },
  { labelId: 'ipar', relation: { basis: 'sibling', modifier: 'spouse' } },
  { labelId: 'orang tua tiri', relation: { basis: 'parent', modifier: 'spouse' } },
  // menantu: suami atau istri anak (KBBI), jangkar self:childSpouse.
  { labelId: 'menantu', relation: { basis: 'self', modifier: 'childSpouse' } },
  { labelId: 'bisan', relation: { basis: 'parent', modifier: 'spouseParent' } },
  { labelId: 'mertua', relation: { basis: 'self', modifier: 'spouseParent' } },
  { labelId: 'besan', relation: { basis: 'child', modifier: 'childSpouse' } },
]

/**
 * Daftar label baku id turunan inlawLabels: pasangan, ipar, orang tua
 * tiri, menantu, bisan, mertua, besan. Urutan mengikuti tabel di atas.
 */
export const INLAW_STANDARD_LABELS: readonly string[] = INLAW_PHRASE_RELATIONS.map(
  (entry) => inlawLabels(entry.relation).id,
)

/** Apakah relasi menyentuh dua set orang tua (besan/bisan, modifier ganda). */
function isTwoSidedParents(relation: InlawRelation): boolean {
  return (
    (relation.basis === 'parent' && relation.modifier === 'spouseParent') ||
    (relation.basis === 'child' && relation.modifier === 'childSpouse')
  )
}

/** Catatan tampilan per locale; besan/bisan menyebut relasi dua set orang tua. */
function inlawDisplayNote(relation: InlawRelation, locale: 'id' | 'en'): string {
  if (isTwoSidedParents(relation)) {
    return locale === 'en'
      ? 'marriage term: relation between two sets of parents through their children'
      : 'istilah fase pernikahan: relasi dua set orang tua karena anak mereka kawin'
  }
  return locale === 'en' ? 'marriage term' : 'istilah fase pernikahan'
}

/**
 * Petakan frasa label baku in-law ke struktur AliasDisplay-compatible.
 * Pencocokan trim dan case-insensitive untuk label id; frasa lain
 * (termasuk alias regional) mengembalikan null.
 */
export function inlawDisplayForPhrase(
  phrase: string,
  locale: 'id' | 'en' = 'id',
): AliasDisplay | null {
  const normalized = phrase.trim().toLowerCase()
  const entry = INLAW_PHRASE_RELATIONS.find((e) => e.labelId === normalized)
  if (entry === undefined) return null
  return {
    label: inlawLabel(entry.relation, locale),
    note: inlawDisplayNote(entry.relation, locale),
    region: null,
    register: null,
  }
}
