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
 * v253-xix: gugus generasi naik, 4 key baru di map global (paman, bibi, om,
 * pakcik), kind parent-sibling depth 1, pola tante pakde. Total key global
 * naik PERSIS 4 (96 jadi 100).
 *
 * Dua sumber tiap entri: KBBI VI kbbi.kemendikdasmen.go.id akses 12 Okt 2026
 * plus Wiktionary ID via api.php revids (paman 1462935, bibi 1312636, om
 * 1122680, pakcik 1122958). Guard homograf dan makna sapaan tidak dipetakan,
 * kasus negatif dites via assertion note. Entri tante live baris 302 tidak
 * disentuh.
 */
describe('kinship-aliases generasi naik (v253-xix, 4 key parent-sibling depth 1)', () => {
  it('1. entri live: paman di map global, kind parent-sibling, depth 1, tanpa qualifier', () => {
    const e = KINSHIP_ALIASES['paman']
    expect(e).toBeDefined()
    expect(e.kind).toBe('parent-sibling')
    expect(e.depth).toBe(1)
    expect(e.qualifier).toBeUndefined()
    expect(e.region).toBeUndefined()
    expect(e.register).toBeUndefined()
  })

  it('2. entri live: bibi di map global, kind parent-sibling, depth 1, tanpa qualifier', () => {
    const e = KINSHIP_ALIASES['bibi']
    expect(e).toBeDefined()
    expect(e.kind).toBe('parent-sibling')
    expect(e.depth).toBe(1)
    expect(e.qualifier).toBeUndefined()
    expect(e.region).toBeUndefined()
    expect(e.register).toBeUndefined()
  })

  it('3. entri live: om di map global, kind parent-sibling, depth 1, qualifier cak', () => {
    const e = KINSHIP_ALIASES['om']
    expect(e).toBeDefined()
    expect(e.kind).toBe('parent-sibling')
    expect(e.depth).toBe(1)
    expect(e.qualifier).toBe('cak')
  })

  it('4. entri live: pakcik di map global, kind parent-sibling, depth 1, qualifier cak', () => {
    const e = KINSHIP_ALIASES['pakcik']
    expect(e).toBeDefined()
    expect(e.kind).toBe('parent-sibling')
    expect(e.depth).toBe(1)
    expect(e.qualifier).toBe('cak')
  })

  it('5. resolveAlias positif keempat key dua arah setara parent-sibling depth 1', () => {
    for (const key of ['paman', 'bibi', 'om', 'pakcik']) {
      const r = resolveAlias(key)
      expect(r).not.toBeNull()
      expect(r?.kind).toBe('parent-sibling')
      expect(r?.depth).toBe(1)
    }
  })

  it('6. kinshipAliasPhrase id dan en untuk paman: om atau tante 1 generasi', () => {
    expect(kinshipAliasPhrase('paman', 'id')).toBe('om atau tante (1 generasi)')
    expect(kinshipAliasPhrase('paman', 'en')).toBe('uncle or aunt (1 generations)')
    expect(kinshipAliasPhrase('bibi', 'id')).toBe('om atau tante (1 generasi)')
    expect(kinshipAliasPhrase('om', 'id')).toBe('om atau tante (1 generasi)')
    expect(kinshipAliasPhrase('pakcik', 'id')).toBe('om atau tante (1 generasi)')
  })

  it('7. expandAliasQuery memuat key baru dan label kanoniknya', () => {
    const ex = expandAliasQuery('paman')
    expect(ex).toContain('paman')
    expect(ex).toContain('om atau tante (1 generasi)')
    expect(ex.length).toBeGreaterThanOrEqual(2)
  })

  it('8. guard bump total key: PERSIS 100 pasca v253-xix', () => {
    expect(Object.keys(KINSHIP_ALIASES)).toHaveLength(120)
    expect(aliasKinds().length).toBe(120)
  })

  it('9. anti-dup: keempat key tepat satu kali, nihil di blok regional mana pun', () => {
    const all = Object.keys(KINSHIP_ALIASES)
    for (const key of ['paman', 'bibi', 'om', 'pakcik']) {
      expect(all.filter((k) => k === key)).toHaveLength(1)
    }
    for (const region of Object.keys(KINSHIP_ALIASES_REGIONAL)) {
      expect(KINSHIP_ALIASES_REGIONAL[region]['paman']).toBeUndefined()
      expect(KINSHIP_ALIASES_REGIONAL[region]['om']).toBeUndefined()
      expect(KINSHIP_ALIASES_REGIONAL[region]['pakcik']).toBeUndefined()
    }
    // bibi Karo tetap live sbg key regional terpisah, wajib tidak tertukar dgn bibi global
    expect(KINSHIP_ALIASES_REGIONAL['Karo']['bibi']).toBeDefined()
    expect(KINSHIP_ALIASES_REGIONAL['Karo']['bibi'].region).toBe('Karo')
  })

  it('10. negatif homograf bibi: bi.bi2 Bg alat pancing hanya note, tidak jadi key', () => {
    expect(resolveAlias('bi.bi2')).toBeNull()
    const note = resolveAlias('bibi')?.note ?? ''
    expect(note).toContain('bi.bi2')
    expect(note).toContain('TIDAK dipetakan')
    expect(note).toContain('1312636')
  })

  it('11. negatif homograf om: om1 p Hindu dan blok nl sv hanya note, tidak jadi key', () => {
    expect(resolveAlias('om1')).toBeNull()
    const note = resolveAlias('om')?.note ?? ''
    expect(note).toContain('om1')
    expect(note).toContain('TIDAK dipetakan')
    expect(note).toContain('1122680')
  })

  it('12. negatif makna pakcik: Prm pembina pramuka siaga putra hanya note, tidak jadi key', () => {
    expect(resolveAlias('pembina pramuka siaga putra')).toBeNull()
    const note = resolveAlias('pakcik')?.note ?? ''
    expect(note).toContain('Prm')
    expect(note).toContain('TIDAK dipetakan')
    expect(note).toContain('1122958')
  })

  it('13. guard paman: disparitas Wiktionary ketat adik laki-laki hanya note, netral urutan KBBI VI yang dipetakan', () => {
    const note = resolveAlias('paman')?.note ?? ''
    expect(note).toContain('netral urutan lahir')
    expect(note).toContain('TIDAK diadopsi')
    expect(note).toContain('1462935')
    expect(note).toContain('DUA SUMBER')
  })

  it('14. non-regresi tetangga: tante paklik etek pakde makcik tetap live kind sama', () => {
    for (const key of ['tante', 'paklik', 'etek', 'pakde', 'makcik']) {
      expect(resolveAlias(key)?.kind).toBe('parent-sibling')
    }
  })

  it('15. posisi gugus parent-sibling pasca sisip: 14 key urut alfabetis', () => {
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
    ])
    expect(ps).toHaveLength(21)
  })

  it('16. negatif typo dan normalisasi kapital dan spasi pinggir', () => {
    expect(resolveAlias('pamann')).toBeNull()
    expect(resolveAlias('PAMAN')).toEqual(resolveAlias('paman'))
    expect(resolveAlias('  Pakcik ')).toEqual(resolveAlias('pakcik'))
  })
})
