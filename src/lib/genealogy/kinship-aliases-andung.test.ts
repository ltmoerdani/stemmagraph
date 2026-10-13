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
 * v253-xii: andung (nenek Melayu/Minangkabau, kind grandparent depth 1,
 * dua sumber, kontrak PM v253-xii ANDUNG). Entri masuk map GLOBAL dengan
 * region Melayu/Minangkabau, pola inyik; blok
 * KINSHIP_ALIASES_REGIONAL tidak dibuat karena inyik live di global.
 * Total key global naik PERSIS 1 (88 jadi 89).
 */
describe('kinship-aliases andung (v253-xii, grandparent depth 1 Melayu/Minangkabau)', () => {
  it('1. entri live: andung di map global, kind grandparent, depth 1, qualifier mk, region Melayu/Minangkabau', () => {
    const e = KINSHIP_ALIASES['andung']
    expect(e).toBeDefined()
    expect(e.kind).toBe('grandparent')
    expect(e.depth).toBe(1)
    expect(e.qualifier).toBe('mk')
    expect(e.region).toBe('Melayu/Minangkabau')
    expect(e.register).toBeUndefined()
  })

  it('2. resolveAlias andung positif tanpa region, dengan region Melayu/Minangkabau sama arah', () => {
    const r = resolveAlias('andung')
    expect(r).not.toBeNull()
    expect(r?.kind).toBe('grandparent')
    expect(r?.depth).toBe(1)
    const rr = resolveAlias('andung', 'Melayu/Minangkabau')
    expect(rr?.kind).toBe('grandparent')
    expect(rr?.region).toBe('Melayu/Minangkabau')
  })

  it('3. resolveAlias region lain tetap resolve via global (semantik resolver aktual: regional prioritas, global fallback)', () => {
    const r = resolveAlias('andung', 'Jawa')
    expect(r).not.toBeNull()
    expect(r?.kind).toBe('grandparent')
    expect(r?.region).toBe('Melayu/Minangkabau')
  })

  it('4. kinshipAliasPhrase id dan en untuk key baru: kakek nenek depth 1', () => {
    expect(kinshipAliasPhrase('andung', 'id')).toBe('kakek nenek (1 generasi)')
    expect(kinshipAliasPhrase('andung', 'en')).toBe('grandparent (1 generations)')
  })

  it('5. expandAliasQuery dari search-filter memuat andung', () => {
    const ex = expandAliasQuery('andung')
    expect(ex).toContain('andung')
    expect(ex.length).toBeGreaterThanOrEqual(2)
  })

  it('6. note memuat dua sumber, revid 1299035, dan guard homonim pohon Bakumpai', () => {
    const note = resolveAlias('andung')?.note ?? ''
    expect(note).toContain('DUA SUMBER')
    expect(note).toContain('kbbi.kemendikdasmen.go.id/entri/andung')
    expect(note).toContain('1299035')
    expect(note).toContain('rfv')
    expect(note).toContain('Bakumpai')
    expect(note).toContain('TIDAK dipetakan')
    expect(note).toContain('Deli/Langkat')
  })

  it('7. kasus negatif homonim: andung Bakumpai nama pohon nihil, andung tetap grandparent', () => {
    expect(KINSHIP_ALIASES['andung (pohon)']).toBeUndefined()
    expect(resolveAlias('andung Bakumpai')).toBeNull()
    expect(resolveAlias('andung')?.kind).toBe('grandparent')
  })

  it('8. negatif: typo nihil, normalisasi huruf besar dan spasi pinggir sama dengan andung', () => {
    expect(resolveAlias('andungg')).toBeNull()
    expect(resolveAlias('ANDUNG')).toEqual(resolveAlias('andung'))
    expect(resolveAlias('  Andung ')).toEqual(resolveAlias('andung'))
  })

  it('9. non-regresi tetangga gugus grandparent regional: inyik dan komposit ompung suhut kind tetap', () => {
    expect(resolveAlias('inyik')?.kind).toBe('grandparent')
    expect(resolveAlias('inyik')?.qualifier).toBe('mk')
    expect(resolveAlias('inyik')?.register).toBe('hormat')
    expect(resolveAlias('ompung suhut', 'Toba')?.kind).toBe('grandparent')
    expect(resolveAlias('ompung suhut', 'Toba')?.depth).toBe(2)
    expect(resolveAlias('ompung suhut')).toBeNull()
    expect(resolveAlias('ninik')?.kind).toBe('grandparent')
    expect(resolveAlias('nenek')?.kind).toBe('grandparent')
  })

  it('10. guard bump total key: Object.keys(KINSHIP_ALIASES) PERSIS 100 pasca v253-xviii', () => {
    expect(Object.keys(KINSHIP_ALIASES)).toHaveLength(112)
    expect(aliasKinds().length).toBe(112)
  })

  it('11. daftar key gugus grandparent global toEqual pasca v253-xviii (16 key, atuk menyisip setelah atok sebelum opa)', () => {
    const gp = Object.keys(KINSHIP_ALIASES).filter(
      (k) => KINSHIP_ALIASES[k]?.kind === 'grandparent'
    )
    expect(gp).toEqual([
      'kakek',
      'nenek',
      'aki',
      'datuk',
      'atok',
      'atuk',
      'opa',
      'oma',
      'eyang',
      'mbah',
      'embah',
      'engkong',
      'andung',
      'inyik',
      'nini',
      'ninik',
    ])
    expect(gp).toHaveLength(16)
  })

  it('12. anti-dup: andung tepat satu kali, nihil di blok regional mana pun', () => {
    const all = Object.keys(KINSHIP_ALIASES)
    expect(all.filter((k) => k === 'andung')).toHaveLength(1)
    for (const region of Object.keys(KINSHIP_ALIASES_REGIONAL)) {
      expect(KINSHIP_ALIASES_REGIONAL[region]['andung']).toBeUndefined()
    }
  })

  it('13. blok regional tidak dibuat: nihil region baru KINSHIP_ALIASES_REGIONAL pasca v253-xii', () => {
    expect(KINSHIP_ALIASES_REGIONAL['Melayu/Minangkabau']).toBeUndefined()
    expect(Object.keys(KINSHIP_ALIASES_REGIONAL)).not.toContain('Melayu/Minangkabau')
  })
})
