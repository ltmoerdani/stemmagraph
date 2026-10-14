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
 * v253-xiv: paklik (paman register Jawa, kind parent-sibling, dual-source,
 * nihil di src sbg key sebelum entri). Entri masuk map GLOBAL pola pakde;
 * blok KINSHIP_ALIASES_REGIONAL tidak dibuat. Total key global naik PERSIS
 * 1 (90 jadi 91).
 *
 * Dua sumber: KBBI VI pak.lik n Jw akr DUA makna (akses 11 Okt 2026) plus
 * Wiktionary ID revid 1040734 via api.php. Guard: makna 1 bapak cilik
 * dipisahkan dan tidak dipetakan sbg relasi, yang dipetakan hanya makna 2
 * sapaan adik laki-laki ibu atau ayah; Wiktionary menggabungkan kedua makna
 * dalam satu baris dan itu tidak diikuti; bagian bahasa Jawa di halaman
 * Wiktionary sama bukan blok bahasa Indonesia sehingga tidak dipetakan.
 */
describe('kinship-aliases paklik (v253-xiv, parent-sibling depth 1, register Jawa)', () => {
  it('1. entri live: paklik di map global, kind parent-sibling, depth 1, qualifier jw, region Jawa, tanpa register', () => {
    const e = KINSHIP_ALIASES['paklik']
    expect(e).toBeDefined()
    expect(e.kind).toBe('parent-sibling')
    expect(e.depth).toBe(1)
    expect(e.qualifier).toBe('jw')
    expect(e.region).toBe('Jawa')
    expect(e.register).toBeUndefined()
  })

  it('2. resolveAlias paklik positif kind parent-sibling depth 1', () => {
    const r = resolveAlias('paklik')
    expect(r).not.toBeNull()
    expect(r?.kind).toBe('parent-sibling')
    expect(r?.depth).toBe(1)
  })

  it('3. kinshipAliasPhrase id dan en untuk paklik: om atau tante 1 generasi', () => {
    expect(kinshipAliasPhrase('paklik', 'id')).toBe('om atau tante (1 generasi)')
    expect(kinshipAliasPhrase('paklik', 'en')).toBe('uncle or aunt (1 generations)')
  })

  it('4. expandAliasQuery dari search-filter memuat paklik', () => {
    const ex = expandAliasQuery('paklik')
    expect(ex).toContain('paklik')
    expect(ex.length).toBeGreaterThanOrEqual(2)
  })

  it('5. note memuat guard makna bapak cilik TIDAK dipetakan plus revid 1040734', () => {
    const note = resolveAlias('paklik')?.note ?? ''
    expect(note).toContain('bapak cilik')
    expect(note).toContain('TIDAK dipetakan')
    expect(note).toContain('1040734')
    expect(note).toContain('DUA SUMBER')
    expect(note).toContain('kbbi.kemendikdasmen.go.id/entri/paklik')
  })

  it('6. non-regresi tetangga gugus parent-sibling live: etek pakde mamak bako emang mang tante tetap, om kini live pasca v253-xix', () => {
    expect(resolveAlias('etek')?.kind).toBe('parent-sibling')
    expect(resolveAlias('pakde')?.kind).toBe('parent-sibling')
    expect(resolveAlias('mamak')?.kind).toBe('parent-sibling')
    expect(resolveAlias('bako')?.kind).toBe('parent-sibling')
    expect(resolveAlias('emang')?.kind).toBe('parent-sibling')
    expect(resolveAlias('mang')?.kind).toBe('parent-sibling')
    expect(resolveAlias('tante')?.kind).toBe('parent-sibling')
    expect(resolveAlias('om')?.kind).toBe('parent-sibling')
  })

  it('7. guard bump total key: Object.keys(KINSHIP_ALIASES) dan aliasKinds PERSIS 100 pasca v253-xviii', () => {
    expect(Object.keys(KINSHIP_ALIASES)).toHaveLength(134)
    expect(aliasKinds().length).toBe(134)
  })

  it('8. daftar key gugus parent-sibling toEqual pasca v253-xiv (10 key, paklik menyisip urutan sort)', () => {
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

  it('9. anti-dup: paklik tepat satu kali, nihil di blok regional mana pun', () => {
    const all = Object.keys(KINSHIP_ALIASES)
    expect(all.filter((k) => k === 'paklik')).toHaveLength(1)
    for (const region of Object.keys(KINSHIP_ALIASES_REGIONAL)) {
      expect(KINSHIP_ALIASES_REGIONAL[region]['paklik']).toBeUndefined()
    }
    expect(KINSHIP_ALIASES_REGIONAL['Jawa']).toBeUndefined()
  })

  it('10. negatif: typo paklikk nihil, normalisasi huruf besar sama dengan paklik', () => {
    expect(resolveAlias('paklikk')).toBeNull()
    expect(resolveAlias('PAKLIK')).toEqual(resolveAlias('paklik'))
    expect(resolveAlias('  Paklik ')).toEqual(resolveAlias('paklik'))
  })

  it('11. guard makna 1 bapak cilik tidak lahir sbg key atau kind terpisah', () => {
    expect(KINSHIP_ALIASES['bapak cilik']).toBeUndefined()
    expect(resolveAlias('paklik')?.kind).toBe('parent-sibling')
    const note = resolveAlias('paklik')?.note ?? ''
    expect(note).toContain('DIPISAHKAN')
    expect(note).toContain('TIDAK diikuti')
  })

  it('12. guard bagian jv Wiktionary tidak dipetakan: nihil homonim blok Jawa sbg key', () => {
    const note = resolveAlias('paklik')?.note ?? ''
    expect(note).toContain('BUKAN blok bahasa Indonesia')
    expect(Object.keys(KINSHIP_ALIASES)).not.toContain('Adik laki-laki bapak')
  })
})
