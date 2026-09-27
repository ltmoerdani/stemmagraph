/**
 * Leksikon fase pernikahan (in-law), GOAL v179iii fase i PURE ONLY.
 *
 * Pola GEDCOM 7: semantik disimpan sebagai basis relasi plus modifier
 * pernikahan, label bahasa diturunkan saat render per locale. Tanpa
 * penyimpanan label utuh, tanpa sentuh KinshipKind 13 kind existing.
 *
 * Modifier ganda (dua sisi): besan dan bisan TIDAK jadi enum baru,
 * diturunkan dari pasangan modifier yang saling berhadapan.
 */

/** Basis relasi yang bisa membawa modifier fase pernikahan. */
export type InlawBasis = 'self' | 'sibling' | 'parent' | 'child'

/** Modifier fase pernikahan di atas basis relasi. */
export type InlawModifier = 'none' | 'spouse' | 'spouseParent' | 'childSpouse'

/** Kombinasi basis plus modifier sebagai identitas relasi in-law. */
export interface InlawRelation {
  basis: InlawBasis
  modifier: InlawModifier
}

/** Modifier terpakai (bukan none). */
export function hasInlawModifier(modifier: InlawModifier): boolean {
  return modifier !== 'none'
}

/**
 * Guard homonim: 'mertua' adalah satu kata baku, bukan gabungan.
 * Label gabungan hanya sah bila modifier ganda diizinkan eksplisit
 * oleh pemanggil (pasangan dua sisi).
 */
export function isComposedInlawLabel(relation: InlawRelation): boolean {
  if (relation.modifier === 'none') return false
  if (relation.basis === 'self' && relation.modifier === 'spouse') return false
  return true
}

/**
 * Pasangan dua sisi: dari sudut pandang berlawanan, besan dan bisan
 * diturunkan dari modifier ganda tanpa enum kelima.
 */
export function inlawCounterpart(relation: InlawRelation): InlawRelation {
  switch (relation.modifier) {
    case 'spouseParent':
      return { basis: 'child', modifier: 'childSpouse' }
    case 'childSpouse':
      return { basis: 'parent', modifier: 'spouseParent' }
    case 'spouse':
      return { basis: 'sibling', modifier: 'spouse' }
    case 'none':
    default:
      return { basis: relation.basis, modifier: 'none' }
  }
}

/**
 * Label baku Indonesia, fonem KBBI: mertua, menantu, ipar, besan, bisan.
 * Regional HANYA lewat jalur phrase (pola GEDCOM 7), bukan enum baru.
 * Label lengkap lewat inlawLabels() di bawah.
 */

/**
 * Label per locale dengan fallback id bila locale tak dikenal.
 * Jangkar gaya kinship-labels.ts (KINSHIP_LABELS).
 */
export function inlawLabel(
  relation: InlawRelation,
  locale: 'id' | 'en' | string,
): string {
  const key: 'id' | 'en' = locale === 'en' ? 'en' : 'id'
  return inlawLabels(relation)[key]
}

/** Tabel label lengkap 13 kombinasi kontrak (4 basis x modifier sah). */
export function inlawLabels(
  relation: InlawRelation,
): Record<'id' | 'en', string> {
  const { basis, modifier } = relation
  switch (`${basis}:${modifier}`) {
    case 'self:none':
      return { id: 'anda', en: 'you' }
    case 'sibling:none':
      return { id: 'saudara', en: 'sibling' }
    case 'parent:none':
      return { id: 'orang tua', en: 'parent' }
    case 'child:none':
      return { id: 'anak', en: 'child' }
    case 'self:spouse':
      return { id: 'pasangan', en: 'spouse' }
    case 'sibling:spouse':
      // ipar: saudara suami atau istri.
      return { id: 'ipar', en: "spouse's sibling" }
    case 'parent:spouse':
      return { id: 'orang tua tiri', en: 'stepparent' }
    case 'child:spouse':
      // menantu: suami atau istri anak.
      return { id: 'menantu', en: "child's spouse" }
    case 'parent:spouseParent':
      // bisan: mertua dari sisi pasangan anak (kombinasi ganda dua sisi).
      return { id: 'bisan', en: "child's parent-in-law" }
    case 'child:childSpouse':
      // besan dilihat dari keluarga seberang: anak kami menjadi menantu mereka.
      return { id: 'besan', en: "child married to their child" }
    case 'self:spouseParent':
      // mertua: orang tua suami atau istri.
      return { id: 'mertua', en: "spouse's parent" }
    case 'self:childSpouse':
      // besan: istri atau suami anak (kombinasi ganda, bukan enum kelima).
      return { id: 'besan', en: "child's spouse" }
    default:
      return { id: 'relasi fase pernikahan', en: 'in-law relation' }
  }
}

/**
 * Jalur phrase regional: bila frasa bukan label baku, kembalikan
 * phrase asli sebagai modifier display tanpa enum baru (pola GEDCOM 7
 * PHRASE). Konsumen UI memutuskan penyajian.
 */
export function inlawPhraseOverride(
  relation: InlawRelation,
  phrase: string,
): string {
  const standard = inlawLabels(relation).id
  return phrase === standard ? standard : `${phrase} (istilah regional)`
}
