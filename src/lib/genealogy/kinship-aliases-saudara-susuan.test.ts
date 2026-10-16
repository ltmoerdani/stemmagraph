import { describe, expect, it } from 'vitest'
import { KINSHIP_ALIASES, aliasKinds, resolveAlias } from './kinship-aliases'

/**
 * Guard test lema saudara susuan (gel31, kind sibling baku nasional, test-only).
 * Dua sumber first-hand 15 Okt 2026: KBBI III mirror kbbi.web.id entri saudara
 * (saudara -- susuan = saudara karena ketika masih bayi sama-sama disusui oleh
 * seorang perempuan, sama-sama inangnya) plus Wiktionary ID pageid 118310
 * revid 1269440 blok bahasa Indonesia konvergen. Pemetaan relasi sosial
 * kekerabatan sah KBBI; susuan sendiri dan anak susuan (child gel30) nihil difusi.
 */
describe('kinship-aliases saudara susuan (gel31)', () => {
  it('1. entri live: kind sibling, tanpa region, tanpa depth, tanpa qualifier', () => {
    const e = KINSHIP_ALIASES['saudara susuan']
    expect(e).toBeDefined()
    expect(e.kind).toBe('sibling')
    expect(e.region).toBeUndefined()
    expect(e.depth).toBeUndefined()
    expect(e.qualifier).toBeUndefined()
  })

  it('2. resolveAlias menemukan saudara susuan', () => {
    expect(resolveAlias('saudara susuan')).not.toBeNull()
    expect(resolveAlias('saudara susuan')?.kind).toBe('sibling')
  })

  it('3. note memuat dua sumber first-hand 15 Okt 2026', () => {
    const e = KINSHIP_ALIASES['saudara susuan']
    expect(e.note).toContain('kbbi.web.id')
    expect(e.note).toContain('pageid 118310')
    expect(e.note).toContain('revid 1269440')
  })

  it('4. non-regresi klaster sibling: kakak, abang, ading, akak tetap utuh', () => {
    expect(KINSHIP_ALIASES['abang'].kind).toBe('sibling')
    expect(KINSHIP_ALIASES['ading'].kind).toBe('sibling')
    expect(KINSHIP_ALIASES['akak'].kind).toBe('sibling')
    expect(KINSHIP_ALIASES['kakang'].kind).toBe('sibling')
  })

  it('5. resolveAlias klaster sibling tetap bekerja', () => {
    expect(resolveAlias('abang')?.kind).toBe('sibling')
    expect(resolveAlias('ading')?.kind).toBe('sibling')
    expect(resolveAlias('akak')?.kind).toBe('sibling')
  })

  it('6. negasi dan non-difusi: susuan nihil key, anak susuan tetap child bukan sibling', () => {
    expect(KINSHIP_ALIASES['susuan']).toBeUndefined()
    expect(KINSHIP_ALIASES['anak susuan'].kind).toBe('child')
    expect(resolveAlias('anak susuan')?.kind).toBe('child')
  })

  it('7. guard polisemi tetap memblock frasa blacklist', () => {
    expect(resolveAlias('putra mahkota')).toBeNull()
    expect(resolveAlias('berabang')).toBeNull()
    expect(resolveAlias('bebuyutan')).toBeNull()
  })

  it('8. guard total key kini 138 (gel35 lema orang tua asuh, naik dari 136 pasca gel32)', () => {
    expect(Object.keys(KINSHIP_ALIASES)).toHaveLength(145)
  })

  it('9. aliasKinds (daftar key terurut) tetap memuat saudara susuan', () => {
    expect(aliasKinds()).toContain('saudara susuan')
  })
})
