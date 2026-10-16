import { describe, expect, it } from 'vitest'
import { KINSHIP_ALIASES, aliasKinds, resolveAlias } from './kinship-aliases'

/**
 * Guard test lema mamanda (gel42, kind parent-sibling depth 1 baku nasional,
 * register hormat, test-only).
 * Dua sumber first-hand 16 Okt 2026: KBBI III mirror kbbi.web.id/mamanda
 * (ma·man·da1 n mamak (untuk takzim); paman, homograf bernomor) plus
 * Wiktionary ID pageid 95382 revid 1218192 via api.php (blok Bahasa
 * Indonesia nomina hormat mamak (untuk takzim); paman, rujukan R:KBBI
 * Daring, flag rfv impor dicatat jujur pola preseden pakde ponakan).
 * Guard: homograf mamanda2 seni teater rakyat Kalimantan Selatan tidak
 * dipetakan, etimologi mama plus -nda hanya note, gugus paman nihil
 * difusi (paman mamak pakde paklik makcik tetap key sendiri), baku
 * nasional tanpa qualifier tanpa region, register hormat pola adinda.
 * Total map 144 menjadi 145.
 */
describe('kinship-aliases mamanda (gel42)', () => {
  const GUARD_KEYS = 145

  it('1. positif: mamanda live kind parent-sibling depth 1', () => {
    const e = KINSHIP_ALIASES['mamanda']
    expect(e).toBeDefined()
    expect(e.kind).toBe('parent-sibling')
    expect(e.depth).toBe(1)
    expect(resolveAlias('mamanda')?.kind).toBe('parent-sibling')
  })

  it('2. register hormat, baku nasional: tanpa region tanpa qualifier (pola makcik + adinda)', () => {
    const e = KINSHIP_ALIASES['mamanda']
    expect(e.register).toBe('hormat')
    expect(e.region).toBeUndefined()
    expect(e.qualifier).toBeUndefined()
  })

  it('3. negasi homograf teater: konsep mamanda2 nihil key terpisah', () => {
    expect(KINSHIP_ALIASES['mamanda2']).toBeUndefined()
    expect(resolveAlias('seni teater mamanda')).toBeNull()
  })

  it('4. anti-difusi: paman tetap key sendiri kind sama', () => {
    const p = KINSHIP_ALIASES['paman']
    expect(p).toBeDefined()
    expect(p.kind).toBe('parent-sibling')
    expect(p).not.toBe(KINSHIP_ALIASES['mamanda'])
  })

  it('5. anti-difusi: mamak Minangkabau tetap key sendiri dengan qualifier', () => {
    const m = KINSHIP_ALIASES['mamak']
    expect(m).toBeDefined()
    expect(m.kind).toBe('parent-sibling')
    expect(m.qualifier).toBe('minangkabau')
  })

  it('6. anti-difusi: makcik tetap key sendiri baku nasional pola serupa', () => {
    const mk = KINSHIP_ALIASES['makcik']
    expect(mk).toBeDefined()
    expect(mk.kind).toBe('parent-sibling')
    expect(mk.register).toBeUndefined()
  })

  it('7. anti-difusi: pakde paklik budhe bude tetap utuh', () => {
    for (const k of ['pakde', 'paklik', 'budhe', 'bude']) {
      expect(KINSHIP_ALIASES[k]).toBeDefined()
      expect(KINSHIP_ALIASES[k].kind).toBe('parent-sibling')
    }
  })

  it('8. resolveAlias konsisten', () => {
    const r = resolveAlias('mamanda')
    expect(r).not.toBeNull()
    expect(r!.depth).toBe(1)
  })

  it('9. urutan sisip gugus paman: mamanda antara mamak dan paman', () => {
    const keys = Object.keys(KINSHIP_ALIASES)
    expect(keys[keys.indexOf('mamanda') - 1]).toBe('mamak')
    expect(keys[keys.indexOf('mamanda') + 1]).toBe('paman')
  })

  it('10. nihil duplikat dan nihil di blacklist', () => {
    const keys = Object.keys(KINSHIP_ALIASES)
    expect(new Set(keys).size).toBe(keys.length)
    expect(aliasKinds()).toContain('mamanda')
  })

  it('11. etimologi hanya note: nihil key turunan mama-nda, mama Karo tetap utuh', () => {
    expect(KINSHIP_ALIASES['nda']).toBeUndefined()
    const m = KINSHIP_ALIASES['mama']
    expect(m).toBeDefined()
    expect(m.kind).toBe('parent-sibling')
    expect(m.region).toBe('Karo')
  })

  it('12. total map PERSIS 145 dan aliasKinds 145 pasca gel42 (GUARD_KEYS bump 144 jadi 145)', () => {
    expect(Object.keys(KINSHIP_ALIASES)).toHaveLength(GUARD_KEYS)
    expect(aliasKinds().length).toBe(GUARD_KEYS)
  })
})
