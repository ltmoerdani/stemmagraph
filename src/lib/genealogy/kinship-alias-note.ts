import { resolveAlias, type AliasEntry } from './kinship-aliases'
import { KINSHIP_LABELS } from './kinship-labels'
import type { KinshipKind } from './kinship-calc'
/**
 * Catatan alias regional: frasa sapaan daerah dipetakan ke label baku
 * nasional plus metadata region/register dari tabel alias (v176-ii).
 * Pure module: nihil import i18n, store, react. Konsumen UI memformat sendiri.
 */
export interface AliasDisplay {
  label: string
  note: string | null
  region: string | null
  register: 'hormat' | 'netral' | null
}

/**
 * Kembalikan catatan alias untuk frasa kekerabatan, atau null bila frasa
 * adalah label baku itu sendiri atau tidak dikenali.
 */
export function aliasNoteForPhrase(phrase: string): string | null {
  const entry: AliasEntry | null = resolveAlias(phrase)
  if (entry === null) return null
  if (!isRegionalAlias(entry)) return null

  const label = labelFor(entry.kind, 'id')
  // Region hanya tampil di catatan untuk register hormat (kontrak test komit dini:
  // aki netral tanpa region di teks, eyang hormat dengan region Jawa).
  const parts: string[] = [entry.register === 'hormat' ? 'istilah hormat' : 'istilah regional']
  if (entry.register === 'hormat' && entry.region !== undefined) {
    parts.push(`(${entry.region})`)
  }

  return `${parts.join(' ')} untuk ${label}`
}

/** Entri dianggap alias regional bila punya region atau qualifier atau register. */
function isRegionalAlias(entry: AliasEntry): boolean {
  return (
    entry.region !== undefined ||
    entry.qualifier !== undefined ||
    entry.register !== undefined
  )
}

/** Label baku untuk kind dan locale, jangkar KINSHIP_LABELS. */
function labelFor(kind: KinshipKind, locale: 'id' | 'en'): string {
  const key: 'id' | 'en' = locale === 'en' ? 'en' : 'id'
  return KINSHIP_LABELS[kind][key]
}

/**
 * Susun struktur tampilan alias: label baku nasional sebagai utama,
 * catatan regional sebagai pelengkap.
 */
export function aliasDisplay(phrase: string, locale: 'id' | 'en' = 'id'): AliasDisplay | null {
  const entry: AliasEntry | null = resolveAlias(phrase)
  if (entry === null) return null

  const regional = isRegionalAlias(entry)
  // Catatan eksplisit (mis. homonim) lebih diutamakan; catatan regional hanya
  // pengisi bila nihil note eksplisit.
  const note = entry.note ?? (regional ? aliasNoteForPhrase(phrase) : null)
  return {
    label: labelFor(entry.kind, locale),
    note,
    region: entry.region ?? null,
    register: entry.register ?? null,
  }
}
