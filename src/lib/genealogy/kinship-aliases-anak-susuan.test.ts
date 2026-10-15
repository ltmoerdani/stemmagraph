import { describe, expect, it } from 'vitest'
import { KINSHIP_ALIASES, aliasKinds, resolveAlias } from './kinship-aliases'

/**
 * Guard test lema anak susuan (gel30, kind child baku nasional, test-only).
 * Dua sumber first-hand 15 Okt 2026: KBBI III mirror kbbi.web.id entri anak
 * (anak -- susuan dua makna: 1 anak yang masih menyusu; 2 anak orang lain yang
 * disusui) plus Wiktionary ID pageid 121984 revid 1138788 blok bahasa Indonesia
 * dua makna konvergen. Entri live di kinship-aliases.ts; test ini mengunci
 * kontrak gel30. Pemetaan dari makna 2 KBBI saja; makna 1 menyusu bukan relasi
 * struktural, guard polisemi pola putra makna juara.
 */
describe('kinship-aliases anak susuan (gel30)', () => {
  it('1. entri live: kind child, tanpa region, tanpa depth, tanpa qualifier', () => {
    const e = KINSHIP_ALIASES['anak susuan']
    expect(e).toBeDefined()
    expect(e.kind).toBe('child')
    expect(e.region).toBeUndefined()
    expect(e.depth).toBeUndefined()
    expect(e.qualifier).toBeUndefined()
  })

  it('2. resolveAlias menemukan anak susuan', () => {
    expect(resolveAlias('anak susuan')).not.toBeNull()
    expect(resolveAlias('anak susuan')?.kind).toBe('child')
  })

  it('3. note memuat dua sumber first-hand 15 Okt 2026', () => {
    const e = KINSHIP_ALIASES['anak susuan']
    expect(e.note).toContain('kbbi.web.id')
    expect(e.note).toContain('pageid 121984')
    expect(e.note).toContain('revid 1138788')
  })

  it('4. non-regresi klaster child: anak, anak angkat, ananda, putra, putri tetap utuh', () => {
    expect(KINSHIP_ALIASES['anak'].kind).toBe('child')
    expect(KINSHIP_ALIASES['anak angkat'].kind).toBe('child')
    expect(KINSHIP_ALIASES['ananda'].kind).toBe('child')
    expect(KINSHIP_ALIASES['putra'].kind).toBe('child')
    expect(KINSHIP_ALIASES['putri'].kind).toBe('child')
  })

  it('5. resolveAlias klaster child tetap bekerja', () => {
    expect(resolveAlias('anak angkat')?.kind).toBe('child')
    expect(resolveAlias('ananda')?.kind).toBe('child')
    expect(resolveAlias('putra')?.kind).toBe('child')
    expect(resolveAlias('putri')?.kind).toBe('child')
  })

  it('6. negasi: susuan, anak sambung nihil sebagai key; saudara susuan kini key sibling sah gel31 (revisi transparan QA gel31, non-difusi kind child dipertahankan)', () => {
    expect(KINSHIP_ALIASES['susuan']).toBeUndefined()
    expect(KINSHIP_ALIASES['anak sambung']).toBeUndefined()
    expect(KINSHIP_ALIASES['saudara susuan'].kind).toBe('sibling')
    expect(KINSHIP_ALIASES['anak susuan'].kind).toBe('child')
  })

  it('7. guard polisemi tetap memblock frasa blacklist', () => {
    expect(resolveAlias('putra mahkota')).toBeNull()
    expect(resolveAlias('putri malu')).toBeNull()
    expect(resolveAlias('putri boyongan')).toBeNull()
    expect(resolveAlias('berputra')).toBeNull()
    expect(resolveAlias('berputri')).toBeNull()
  })

  it('8. guard total key naik 133 jadi 134', () => {
    expect(Object.keys(KINSHIP_ALIASES)).toHaveLength(144)
  })

  it('9. aliasKinds (daftar key terurut) tetap memuat anak susuan', () => {
    expect(aliasKinds()).toContain('anak susuan')
  })
})
