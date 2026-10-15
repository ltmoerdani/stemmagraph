import { describe, expect, it } from 'vitest'
import { KINSHIP_ALIASES, aliasKinds, resolveAlias } from './kinship-aliases'

/**
 * Guard test lema sulung (gel32, kind sibling depth 1 baku nasional, test-only).
 * Dua sumber first-hand 15 Okt 2026: KBBI III mirror kbbi.web.id entri sulung
 * ((anak) yang tertua, contoh anak sulung, satu lema nihil homograf bernomor)
 * plus Wiktionary ID pageid 50045 revid 1369557 blok bahasa Indonesia konvergen.
 * Pola senioritas kebalikan semantik ucu/ading; komposit anak sulung nihil key
 * terpisah (tercover resolusi lema tunggal); glosa bungsu tetap nihil key.
 */
describe('kinship-aliases sulung (gel32)', () => {
  it('1. entri live: kind sibling, depth 1, tanpa region, tanpa qualifier', () => {
    const e = KINSHIP_ALIASES['sulung']
    expect(e).toBeDefined()
    expect(e.kind).toBe('sibling')
    expect(e.depth).toBe(1)
    expect(e.region).toBeUndefined()
    expect(e.qualifier).toBeUndefined()
  })

  it('2. resolveAlias menemukan sulung', () => {
    expect(resolveAlias('sulung')).not.toBeNull()
    expect(resolveAlias('sulung')?.kind).toBe('sibling')
    expect(resolveAlias('sulung')?.depth).toBe(1)
  })

  it('3. note memuat dua sumber first-hand 15 Okt 2026', () => {
    const e = KINSHIP_ALIASES['sulung']
    expect(e.note).toContain('kbbi.web.id')
    expect(e.note).toContain('pageid 50045')
    expect(e.note).toContain('revid 1369557')
  })

  it('4. non-regresi klaster sibling: ucu, ading, abang, adinda, senina, sembuyak tetap utuh', () => {
    expect(KINSHIP_ALIASES['ucu'].kind).toBe('sibling')
    expect(KINSHIP_ALIASES['ading'].kind).toBe('sibling')
    expect(KINSHIP_ALIASES['abang'].kind).toBe('sibling')
    expect(KINSHIP_ALIASES['adinda'].kind).toBe('sibling')
    expect(KINSHIP_ALIASES['senina'].kind).toBe('sibling')
    expect(KINSHIP_ALIASES['sembuyak'].kind).toBe('sibling')
  })

  it('5. pola senioritas: sulung sejajar ucu dan ading sbg sibling depth 1 tanpa region', () => {
    for (const key of ['sulung', 'ucu', 'ading']) {
      expect(KINSHIP_ALIASES[key].kind).toBe('sibling')
      expect(KINSHIP_ALIASES[key].depth).toBe(1)
      expect(KINSHIP_ALIASES[key].region).toBeUndefined()
    }
  })

  it('6. negasi dan non-difusi: anak sulung nihil key terpisah, bungsu tetap nihil key', () => {
    expect(KINSHIP_ALIASES['anak sulung']).toBeUndefined()
    expect(resolveAlias('anak sulung')).toBeNull()
    expect(KINSHIP_ALIASES['bungsu']).toBeUndefined()
    expect(resolveAlias('bungsu')).toBeNull()
  })

  it('7. guard polisemi tetap memblock frasa blacklist', () => {
    expect(resolveAlias('putra mahkota')).toBeNull()
    expect(resolveAlias('berabang')).toBeNull()
    expect(resolveAlias('bebuyutan')).toBeNull()
  })

  it('8. guard total key naik 136 jadi 138 (gel35, lema orang tua asuh)', () => {
    expect(Object.keys(KINSHIP_ALIASES)).toHaveLength(140)
  })

  it('9. aliasKinds (daftar key terurut) tetap memuat sulung', () => {
    expect(aliasKinds()).toContain('sulung')
    expect(aliasKinds().length).toBe(140)
  })
})
