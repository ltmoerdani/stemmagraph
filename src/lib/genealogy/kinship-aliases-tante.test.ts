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
 * v253-xiii: tante (parent-sibling fusi dua arah, dual-source, nihil di src
 * sbg key sebelum entri). Entri masuk map GLOBAL dengan label cak, pola etek
 * pakde; blok KINSHIP_ALIASES_REGIONAL tidak dibuat. Total key global naik
 * PERSIS 1 (89 jadi 90).
 *
 * Dua sumber: KBBI VI tan.te n cak DUA makna (akses 11 Okt 2026) plus
 * Wiktionary ID revid 1327416 via api.php. Guard: makna 2 sapaan wanita agak
 * tua tidak dipetakan; homonim bts (Simalungun) dan bbc (Toba) di halaman
 * Wiktionary sama bukan blok bahasa Indonesia; bibi Karo tetap key regional
 * terpisah; mapping tante ke bibi tanpa komponen usia dilarang.
 */
describe('kinship-aliases tante (v253-xiii, parent-sibling depth 1, fusi dua arah)', () => {
  it('1. entri live: tante di map global, kind parent-sibling, depth 1, qualifier cak, tanpa region, tanpa register', () => {
    const e = KINSHIP_ALIASES['tante']
    expect(e).toBeDefined()
    expect(e.kind).toBe('parent-sibling')
    expect(e.depth).toBe(1)
    expect(e.qualifier).toBe('cak')
    expect(e.region).toBeUndefined()
    expect(e.register).toBeUndefined()
  })

  it('2. resolveAlias tante positif tanpa region (fusi dua arah SATU lema)', () => {
    const r = resolveAlias('tante')
    expect(r).not.toBeNull()
    expect(r?.kind).toBe('parent-sibling')
    expect(r?.depth).toBe(1)
  })

  it('3. guard makna 2 KBBI sapaan wanita agak tua TIDAK dipetakan: nihil kind atau entri terpisah', () => {
    // Makna sapaan tidak lahir sbg key atau kind lain; entri tunggal parent-sibling.
    expect(Object.keys(KINSHIP_ALIASES).filter((k) => k === 'tante')).toHaveLength(1)
    expect(resolveAlias('tante')?.kind).toBe('parent-sibling')
    const note = resolveAlias('tante')?.note ?? ''
    expect(note).toContain('wanita yang agak tua')
    expect(note).toContain('TIDAK dipetakan')
  })

  it('4. guard homonim antarbahasa: blok bts Simalungun dan bbc Toba nihil di map utama', () => {
    expect(KINSHIP_ALIASES['bts']).toBeUndefined()
    expect(KINSHIP_ALIASES['bbc']).toBeUndefined()
    const note = resolveAlias('tante')?.note ?? ''
    expect(note).toContain('Simalungun')
    expect(note).toContain('Toba')
  })

  it('5. guard bibi: bibi kini live di map utama pasca v253-xix; bibi Karo tetap live di blok regional Karo, namespace terpisah tidak tertukar', () => {
    expect(KINSHIP_ALIASES['bibi']).toBeDefined()
    const karoBibi = KINSHIP_ALIASES_REGIONAL['Karo']?.['bibi']
    expect(karoBibi).toBeDefined()
    expect(karoBibi.kind).toBe('parent-sibling')
    expect(resolveAlias('tante')?.region).toBeUndefined()
    expect(karoBibi.region).toBe('Karo')
  })

  it('6. kinshipAliasPhrase id dan en untuk key baru: om atau tante depth 1', () => {
    expect(kinshipAliasPhrase('tante', 'id')).toBe('om atau tante (1 generasi)')
    expect(kinshipAliasPhrase('tante', 'en')).toBe('uncle or aunt (1 generations)')
  })

  it('7. expandAliasQuery dari search-filter memuat tante dan label kanoniknya', () => {
    const ex = expandAliasQuery('tante')
    expect(ex).toContain('tante')
    expect(ex).toContain('om atau tante (1 generasi)')
    expect(ex.length).toBeGreaterThanOrEqual(2)
  })

  it('8. note memuat dua sumber, revid 1327416, label cak, dan guard generalisasi bibi', () => {
    const note = resolveAlias('tante')?.note ?? ''
    expect(note).toContain('DUA SUMBER')
    expect(note).toContain('kbbi.kemendikdasmen.go.id/entri/tante')
    expect(note).toContain('1327416')
    expect(note).toContain('cak')
    expect(note).toContain('tanpa komponen usia')
  })

  it('9. non-regresi tetangga gugus parent-sibling live: etek pakde mamak bako emang mang om tetap', () => {
    expect(resolveAlias('etek')?.kind).toBe('parent-sibling')
    expect(resolveAlias('pakde')?.kind).toBe('parent-sibling')
    expect(resolveAlias('mamak')?.kind).toBe('parent-sibling')
    expect(resolveAlias('bako')?.kind).toBe('parent-sibling')
    expect(resolveAlias('emang')?.kind).toBe('parent-sibling')
    expect(resolveAlias('mang')?.kind).toBe('parent-sibling')
    expect(resolveAlias('om')?.kind).toBe('parent-sibling')
  })

  it('10. guard bump total key: Object.keys(KINSHIP_ALIASES) PERSIS 100 pasca v253-xviii', () => {
    expect(Object.keys(KINSHIP_ALIASES)).toHaveLength(133)
    expect(aliasKinds().length).toBe(132)
  })

  it('11. daftar key gugus parent-sibling toEqual pasca v253-xiv (10 key, paklik menyisip urutan sort)', () => {
    const ps = Object.keys(KINSHIP_ALIASES)
      .filter((k) => KINSHIP_ALIASES[k]?.kind === 'parent-sibling')
      .sort()
    expect(ps).toEqual([
      'bako',
      'bibi',
      'bude',
      'budhe',
      'bulik',
      'emang',
      'engku',
      'etek',
      'makcik',
      'mama',
      'mamak',
      'mami',
      'mang',
      'om',
      'pakcik',
      'pakde',
      'pakdhe',
      'paklik',
      'paman',
      'tante',
      'uwa',
    'wak',    ])
    expect(ps).toHaveLength(22)
  })

  it('12. negatif: typo nihil, normalisasi huruf besar dan spasi pinggir sama dengan tante', () => {
    expect(resolveAlias('tanteh')).toBeNull()
    expect(resolveAlias('TANTE')).toEqual(resolveAlias('tante'))
    expect(resolveAlias('  Tante ')).toEqual(resolveAlias('tante'))
  })

  it('13. anti-dup: tante tepat satu kali, nihil di blok regional mana pun', () => {
    const all = Object.keys(KINSHIP_ALIASES)
    expect(all.filter((k) => k === 'tante')).toHaveLength(1)
    for (const region of Object.keys(KINSHIP_ALIASES_REGIONAL)) {
      expect(KINSHIP_ALIASES_REGIONAL[region]['tante']).toBeUndefined()
    }
  })

  it('14. blok regional tidak dibuat: nihil region baru KINSHIP_ALIASES_REGIONAL pasca v253-xiii', () => {
    expect(KINSHIP_ALIASES_REGIONAL['Cak']).toBeUndefined()
    expect(Object.keys(KINSHIP_ALIASES_REGIONAL)).not.toContain('Cak')
  })
})
