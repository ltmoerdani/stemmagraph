import { describe, it, expect } from 'vitest'
import {
  KINSHIP_ALIASES,
  KINSHIP_ALIASES_REGIONAL,
  resolveAlias,
  aliasKinds,
} from './kinship-aliases'
import { kinshipAliasPhrase } from './kinship-alias-phrase'
import { expandAliasQuery } from './search-filter'

/**
 * v253-viii: duo emang + mang (paman Sunda, dual-source, kontrak PM
 * kontrak-v253viii-stg-emang-mang-2026-10-10.md). Salvase PM 11 Okt 2026:
 * komit dini eksekutor 6a2e7cc (scaffold) diadopsi lalu dilengkapi penuh.
 * Total key global naik PERSIS +2 (82 jadi 84), pola tanpa region field
 * ala engkoh/koko (qualifier sunda saja) agar nihil bump daftar region.
 */
describe('kinship-aliases emang dan mang (v253-viii, parent-sibling depth 1 Sunda)', () => {
  it('1. entri live: emang dan mang di map global, kind parent-sibling depth 1 qualifier sunda, nihil region field', () => {
    const e = KINSHIP_ALIASES['emang']
    const m = KINSHIP_ALIASES['mang']
    expect(e).toBeDefined()
    expect(e.kind).toBe('parent-sibling')
    expect(e.depth).toBe(1)
    expect(e.qualifier).toBe('sunda')
    expect(e.region).toBeUndefined()
    expect(m).toBeDefined()
    expect(m.kind).toBe('parent-sibling')
    expect(m.depth).toBe(1)
    expect(m.qualifier).toBe('sunda')
    expect(m.region).toBeUndefined()
  })

  it('2. resolveAlias kedua key dengan dan tanpa region Sunda, blok regional nihil', () => {
    expect(resolveAlias('emang')?.kind).toBe('parent-sibling')
    expect(resolveAlias('mang')?.kind).toBe('parent-sibling')
    expect(resolveAlias('emang', 'Toba')?.kind).toBe('parent-sibling')
    expect(resolveAlias('mang', 'Jawa')?.kind).toBe('parent-sibling')
  })

  it('3. kinshipAliasPhrase id dan en untuk kedua key: om atau tante depth 1', () => {
    expect(kinshipAliasPhrase('emang', 'id')).toBe('om atau tante (1 generasi)')
    expect(kinshipAliasPhrase('emang', 'en')).toBe('uncle or aunt (1 generations)')
    expect(kinshipAliasPhrase('mang', 'id')).toBe('om atau tante (1 generasi)')
    expect(kinshipAliasPhrase('mang', 'en')).toBe('uncle or aunt (1 generations)')
  })

  it('4. expansion query mengenali kedua key menjadi label kanonik id', () => {
    expect(expandAliasQuery('emang')).toEqual([
      'emang',
      'om atau tante (1 generasi)',
    ])
    expect(expandAliasQuery('mang')).toEqual([
      'mang',
      'om atau tante (1 generasi)',
    ])
  })

  it('5. guard homonim mang: note memuat sapaan sebaya paman sebagai makna yang TIDAK dipetakan', () => {
    const note = resolveAlias('mang')?.note ?? ''
    expect(note).toContain('GUARD HOMONIM')
    expect(note).toContain('sebaya paman')
    expect(note).toContain('TIDAK dipetakan')
  })

  it('6. guard homonim nihil emang: query emang hanya mengenali key emang, note mencatat kekosongan homonim', () => {
    const entriesEmang = Object.keys(KINSHIP_ALIASES).filter((k) => k === 'emang')
    expect(entriesEmang).toHaveLength(1)
    const note = resolveAlias('emang')?.note ?? ''
    expect(note).toContain('nihil homonim kekerabatan lain')
  })

  it('7. note memuat dua sumber resmi untuk masing-masing key', () => {
    const ne = resolveAlias('emang')?.note ?? ''
    expect(ne).toContain('DUA SUMBER')
    expect(ne).toContain('kbbi.kemendikdasmen.go.id/entri/emang')
    expect(ne).toContain('1322355')
    const nm = resolveAlias('mang')?.note ?? ''
    expect(nm).toContain('DUA SUMBER')
    expect(nm).toContain('kbbi.kemendikdasmen.go.id/entri/mang')
    expect(nm).toContain('1404703')
    expect(nm).toContain('rfv')
  })

  it('8. non-regresi tetangga gugus saudara orang tua: pakde Jawa, mamak Minangkabau, tulang Toba utuh', () => {
    expect(resolveAlias('pakde')?.qualifier).toBe('jw')
    expect(resolveAlias('mamak')?.qualifier).toBe('minangkabau')
    expect(resolveAlias('tulang', 'Toba')?.kind).toBe('parent-sibling')
  })

  it('9. guard bump total key: 85 pasca v253-ix bako di map global dan aliasKinds', () => {
    expect(Object.keys(KINSHIP_ALIASES)).toHaveLength(117)
    expect(aliasKinds().length).toBe(117)
  })

  it('10. anti-dup: emang dan mang muncul tepat satu kali global dan nihil di semua blok regional', () => {
    const all = Object.keys(KINSHIP_ALIASES)
    expect(all.filter((k) => k === 'emang')).toHaveLength(1)
    expect(all.filter((k) => k === 'mang')).toHaveLength(1)
    for (const region of Object.keys(KINSHIP_ALIASES_REGIONAL)) {
      expect(KINSHIP_ALIASES_REGIONAL[region]['emang']).toBeUndefined()
      expect(KINSHIP_ALIASES_REGIONAL[region]['mang']).toBeUndefined()
    }
  })

  it('11. normalisasi: EMANG, spasi pinggir, dan emang sama dengan emang; titik tengah e.mang berbeda key sah tidak dipetakan', () => {
    expect(resolveAlias('EMANG')).toEqual(resolveAlias('emang'))
    expect(resolveAlias('  Emang ')).toEqual(resolveAlias('emang'))
    expect(resolveAlias('e.mang')).toBeNull()
    expect(resolveAlias('MANG')).toEqual(resolveAlias('mang'))
  })

  it('12. guard emang tanpa makna kedua di jangkar: note mencatat tunggal, nihil sense kedua', () => {
    const note = resolveAlias('emang')?.note ?? ''
    expect(note).toContain('tunggal nihil homograf bernomor')
  })

  it('13. susunan key parent-sibling global tumbuh konsisten: emang dan mang menyisip alfabetis', () => {
    const ps = Object.keys(KINSHIP_ALIASES)
      .filter((k) => KINSHIP_ALIASES[k]?.kind === 'parent-sibling')
      .sort()
    expect(ps).toContain('emang')
    expect(ps).toContain('mang')
    expect(ps).toContain('bulik')
    expect(ps).toContain('mama')
    expect(ps).toContain('mamak')
    expect(ps).toContain('mami')
    expect(ps).toContain('pakde')
    expect(ps.indexOf('emang')).toBeLessThan(ps.indexOf('mang'))
  })

  it('14. guard homonim sapaan mang tidak membuat jalur sapaan lain bergeser: memang adverbia tidak berentri', () => {
    expect(KINSHIP_ALIASES['memang']).toBeUndefined()
    expect(resolveAlias('memang')).toBeNull()
  })
})
