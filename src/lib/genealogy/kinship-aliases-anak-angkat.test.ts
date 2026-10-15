import { describe, expect, it } from 'vitest'
import { KINSHIP_ALIASES, aliasKinds, resolveAlias } from './kinship-aliases'

/**
 * Guard test lema anak angkat (gel29, kind child baku nasional, test-only).
 * Dua sumber first-hand 15 Okt 2026: KBBI III mirror kbbi.web.id (anak -- pungut =
 * anak angkat; orang tua angkat = ayah ibu berdasarkan adat atau hukum) plus
 * Wiktionary ID pageid 121299 revid 1284384 blok bahasa Indonesia.
 * Entri live ada di kinship-aliases.ts; test ini mengunci kontrak gel29.
 */
describe('kinship-aliases anak angkat (gel29)', () => {
  it('1. entri live: kind child, tanpa region, tanpa depth, tanpa qualifier', () => {
    const e = KINSHIP_ALIASES['anak angkat']
    expect(e).toBeDefined()
    expect(e.kind).toBe('child')
    expect(e.region).toBeUndefined()
    expect(e.depth).toBeUndefined()
    expect(e.qualifier).toBeUndefined()
  })

  it('2. resolveAlias menemukan anak angkat', () => {
    expect(resolveAlias('anak angkat')).not.toBeNull()
    expect(resolveAlias('anak angkat')?.kind).toBe('child')
  })

  it('3. note memuat dua sumber first-hand 15 Okt 2026', () => {
    const e = KINSHIP_ALIASES['anak angkat']
    expect(e.note).toContain('kbbi.web.id')
    expect(e.note).toContain('pageid 121299')
    expect(e.note).toContain('revid 1284384')
  })

  it('4. non-regresi klaster child: anak, ananda, putra, putri tetap utuh', () => {
    expect(KINSHIP_ALIASES['anak'].kind).toBe('child')
    expect(KINSHIP_ALIASES['ananda'].kind).toBe('child')
    expect(KINSHIP_ALIASES['putra'].kind).toBe('child')
    expect(KINSHIP_ALIASES['putri'].kind).toBe('child')
  })

  it('5. non-regresi tetangga: keponakan sibling-child, mertua property, mantu live', () => {
    expect(KINSHIP_ALIASES['keponakan'].kind).toBe('sibling-child')
    expect(KINSHIP_ALIASES['mertua'].kind).toBe('property')
    expect(KINSHIP_ALIASES['mantu']).toBeDefined()
  })

  it('6. negasi: angkat, anak tiri, anak piara, anak pungut nihil sebagai key', () => {
    expect(KINSHIP_ALIASES['angkat']).toBeUndefined()
    expect(KINSHIP_ALIASES['anak tiri']).toBeUndefined()
    expect(KINSHIP_ALIASES['anak piara']).toBeUndefined()
    expect(KINSHIP_ALIASES['anak pungut']).toBeUndefined()
  })

  it('7. negasi: anak didik dan orang tua nihil sebagai key, anak asuh kini live pasca gel36', () => {
    expect(KINSHIP_ALIASES['anak didik']).toBeUndefined()
    expect(KINSHIP_ALIASES['anak asuh']).toBeDefined()
    expect(KINSHIP_ALIASES['orang tua']).toBeUndefined()
  })

  it('8. guard total key kini 138 pasca gel35 (136 sejak gel32, lema orang tua asuh)', () => {
    expect(Object.keys(KINSHIP_ALIASES)).toHaveLength(144)
  })

  it('9. aliasKinds (daftar key terurut) tetap memuat anak angkat', () => {
    expect(aliasKinds()).toContain('anak angkat')
  })
})
