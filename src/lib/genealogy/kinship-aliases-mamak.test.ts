import { describe, it, expect } from 'vitest'
import {
  KINSHIP_ALIASES,
  KINSHIP_ALIASES_REGIONAL,
  resolveAlias,
  aliasKinds,
} from './kinship-aliases'
import { kinshipAliasPhrase } from './kinship-alias-phrase'

/**
 * v253-vii: mamak (paman Minangkabau, dua sumber, kontrak PM v253-vii MAMAK).
 * Keputusan arsitektur: total key global naik PERSIS 1 (81 jadi 82) hanya
 * tercapai bila mamak masuk map GLOBAL dengan region Minangkabau, pola inyik
 * (Melayu/Minangkabau); blok KINSHIP_ALIASES_REGIONAL.Minangkabau belum ada
 * di tip dan tidak dibuat di task ini.
 */
describe('kinship-aliases mamak (v253-vii, parent-sibling depth 1 Minangkabau)', () => {
  it('1. entri live: mamak di map global, kind parent-sibling, depth 1, qualifier minangkabau, region Minangkabau', () => {
    const e = KINSHIP_ALIASES['mamak']
    expect(e).toBeDefined()
    expect(e.kind).toBe('parent-sibling')
    expect(e.depth).toBe(1)
    expect(e.qualifier).toBe('minangkabau')
    expect(e.region).toBe('Minangkabau')
  })

  it('2. resolveAlias mamak dengan region Minangkabau: entri global terjangkau lewat fallback blok nihil', () => {
    const r = resolveAlias('mamak', 'Minangkabau')
    expect(r).not.toBeNull()
    expect(r?.kind).toBe('parent-sibling')
    expect(r?.depth).toBe(1)
    expect(r?.region).toBe('Minangkabau')
    expect(KINSHIP_ALIASES_REGIONAL['Minangkabau']).toBeUndefined()
  })

  it('3. kinshipAliasPhrase id dan en untuk key baru: om atau tante depth 1', () => {
    expect(kinshipAliasPhrase('mamak', 'id')).toBe('om atau tante (1 generasi)')
    expect(kinshipAliasPhrase('mamak', 'en')).toBe('uncle or aunt (1 generations)')
  })

  it('4. note memuat guard makna ibu tidak dipetakan dan penanda dua sumber', () => {
    const note = resolveAlias('mamak')?.note ?? ''
    expect(note).toContain('DUA SUMBER')
    expect(note).toContain('kbbi.kemendikdasmen.go.id/entri/mamak')
    expect(note).toContain('1467750')
    expect(note).toContain('TIDAK dipetakan')
    expect(note).toContain('n Bt ibu')
    expect(note).toContain('rfv')
  })

  it('5. negatif tanpa region sesuai semantik resolver aktual: mamak global resolve tanpa region, gugus tanpa entri nihil', () => {
    expect(resolveAlias('mamak')).not.toBeNull()
    expect(resolveAlias('emang')).toBeNull()
    expect(resolveAlias('mang')).toBeNull()
    expect(resolveAlias('mak')).toBeNull()
    expect(resolveAlias('amak')).toBeNull()
    expect(KINSHIP_ALIASES['emang']).toBeUndefined()
    expect(KINSHIP_ALIASES['mang']).toBeUndefined()
  })

  it('6. non-regresi tetangga gugus paman: mama dan mami Karo utuh, pakde Jawa utuh', () => {
    expect(resolveAlias('mama', 'Karo')?.kind).toBe('parent-sibling')
    expect(resolveAlias('mama', 'Karo')?.region).toBe('Karo')
    expect(resolveAlias('mami', 'Karo')?.kind).toBe('parent-sibling')
    expect(resolveAlias('pakde')?.qualifier).toBe('jw')
    expect(resolveAlias('pakde')?.depth).toBe(1)
  })

  it('7. daftar key parent-sibling global PERSIS empat, mamak menyisip alfabetis antara mama dan mami', () => {
    const ps = Object.keys(KINSHIP_ALIASES)
      .filter((k) => KINSHIP_ALIASES[k]?.kind === 'parent-sibling')
      .sort()
    expect(ps).toEqual(['mama', 'mamak', 'mami', 'pakde'])
  })

  it('8. guard bump total key: Object.keys(KINSHIP_ALIASES) PERSIS 82 pasca v253-vii', () => {
    expect(Object.keys(KINSHIP_ALIASES)).toHaveLength(82)
    expect(aliasKinds().length).toBe(82)
  })

  it('9. anti-dup: key mamak muncul tepat satu kali di daftar global dan nihil di semua blok regional', () => {
    const all = Object.keys(KINSHIP_ALIASES)
    expect(all.filter((k) => k === 'mamak')).toHaveLength(1)
    expect(aliasKinds().filter((k) => k === 'mamak')).toHaveLength(1)
    for (const region of Object.keys(KINSHIP_ALIASES_REGIONAL)) {
      expect(KINSHIP_ALIASES_REGIONAL[region]['mamak']).toBeUndefined()
    }
  })

  it('10. normalisasi: MAMAK, spasi pinggir, dan titik tengah sama dengan mamak', () => {
    expect(resolveAlias('MAMAK')).toEqual(resolveAlias('mamak'))
    expect(resolveAlias('  Mamak ')).toEqual(resolveAlias('mamak'))
  })

  it('11. homonim bahasa lain Wiktionary tidak dipetakan: bjn, mqg, pse, jax, min cukup tercatat di note', () => {
    const note = resolveAlias('mamak')?.note ?? ''
    expect(note).toContain('bjn')
    expect(note).toContain('mqg')
    expect(note).toContain('min')
    const mk = Object.keys(KINSHIP_ALIASES).filter(
      (k) => KINSHIP_ALIASES[k]?.qualifier === 'minangkabau',
    )
    expect(mk).toEqual(['mamak'])
  })

  it('12. guard emang dan mang tetap nihil entri di tip, konsisten verifikasi 10 Okt 2026', () => {
    expect(aliasKinds()).not.toContain('emang')
    expect(aliasKinds()).not.toContain('mang')
    expect(aliasKinds()).not.toContain('bako')
    expect(resolveAlias('bako')).toBeNull()
  })
})
